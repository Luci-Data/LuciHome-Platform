// ==========================================================================
// LuciHome — client-side image compression before upload
//
// Downscales and re-encodes photos right in the browser before they're
// uploaded, so a multi-MB phone photo becomes a few hundred KB. Faster
// uploads, faster pages for everyone browsing listings, and far less
// storage used. Used for both listing photos and profile avatars.
// ==========================================================================

function compressImage(file, maxDimension, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round(height * (maxDimension / width));
            width = maxDimension;
          } else {
            width = Math.round(width * (maxDimension / height));
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; } // fall back to the original if compression fails
          resolve(new File([blob], renameToJpg(file.name), { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };

      img.onerror = () => resolve(file); // fall back to the original on any load error
      img.src = e.target.result;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function renameToJpg(filename) {
  const dot = filename.lastIndexOf('.');
  const base = dot === -1 ? filename : filename.slice(0, dot);
  return `${base}.jpg`;
}
