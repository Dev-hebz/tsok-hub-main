const CLOUDINARY_CLOUD_NAME = 'dpcv25eeh';
const CLOUDINARY_UPLOAD_PRESET = 'Tsok-Facebook';

export const uploadToCloudinary = async (file, folder = 'tsok-social') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) throw new Error('Failed to upload image to Cloudinary');
  const data = await response.json();
  return data.secure_url;
};

// Compress video in-browser before uploading using MediaRecorder
export const compressVideo = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const MAX_MB = 50;
    const MAX_BYTES = MAX_MB * 1024 * 1024;

    // If already small enough, skip compression
    if (file.size <= MAX_BYTES) {
      onProgress?.(100);
      resolve(file);
      return;
    }

    const video = document.createElement('video');
    video.muted = true;
    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      // Scale down resolution — max 720p
      const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(24); // 24fps

      // Add audio track if present
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));

      // Pick best supported codec
      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
        m => MediaRecorder.isTypeSupported(m)
      ) || 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1_000_000, // 1 Mbps — good quality but compressed
      });

      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        audioCtx.close();
        URL.revokeObjectURL(video.src);
        const blob = new Blob(chunks, { type: mimeType });
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.webm'), { type: mimeType });
        onProgress?.(100);
        resolve(compressed);
      };
      recorder.onerror = () => { URL.revokeObjectURL(video.src); resolve(file); }; // fallback to original

      // Draw frames while playing
      const drawFrame = () => {
        if (video.ended || video.paused) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const pct = Math.round((video.currentTime / video.duration) * 95);
        onProgress?.(pct);
        requestAnimationFrame(drawFrame);
      };

      video.onplay = () => { recorder.start(); drawFrame(); };
      video.onended = () => { recorder.stop(); };
      video.play().catch(() => { resolve(file); });
    };

    video.onerror = () => resolve(file); // fallback
  });
};

export const uploadVideoToCloudinary = async (file, folder = 'tsok-posts', onProgress) => {
  // Compress first
  const compressed = await compressVideo(file, p => onProgress?.(Math.round(p * 0.7))); // 0-70% = compression

  const formData = new FormData();
  formData.append('file', compressed);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);
  formData.append('resource_type', 'video');

  // Use XMLHttpRequest for upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = 70 + Math.round((e.loaded / e.total) * 30); // 70-100% = upload
        onProgress?.(pct);
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url);
      } else {
        reject(new Error('Video upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
};
