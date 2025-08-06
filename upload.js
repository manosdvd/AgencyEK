document.addEventListener('DOMContentLoaded', () => {
    const fileUploadInput = document.getElementById('fileUploadInput');
    const uploadButton = document.getElementById('uploadButton');
    const dossierImage = document.getElementById('dossierImage');
    const statusMessage = document.getElementById('statusMessage');

    // Trigger the hidden file input when the styled button is clicked
    uploadButton.addEventListener('click', () => {
        fileUploadInput.click();
    });

    // Handle the file selection
    fileUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return; // No file selected
        }

        // Check file size (ImageKit free plan has a 25MB limit)
        if (file.size > 25 * 1024 * 1024) {
            statusMessage.textContent = 'Error: File size exceeds 25 MB.';
            statusMessage.style.color = 'red';
            return;
        }

        statusMessage.textContent = 'Uploading...';
        statusMessage.style.color = '#666';

        try {
            // Step 1: Get authentication parameters from your backend server
            const authResponse = await fetch('http://localhost:3001/auth');
            if (!authResponse.ok) {
                throw new Error(`Authentication failed with status: ${authResponse.status}`);
            }
            const { token, expire, signature } = await authResponse.json();

            // Step 2: Prepare form data for ImageKit upload
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileName', file.name);
            formData.append('publicKey', "public_rJ83Er/Hs9uSD4BdDxH+wZ9n9m8=");
            formData.append('signature', signature);
            formData.append('expire', expire);
            formData.append('token', token);

            // Step 3: Upload the file to ImageKit
            const uploadResponse = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                const errorResult = await uploadResponse.json();
                throw new Error(`Upload failed: ${errorResult.message || 'Unknown error'}`);
            }

            const result = await uploadResponse.json();

            // Step 4: Update the image placeholder with the new image URL
            dossierImage.src = result.url;
            statusMessage.textContent = 'Upload successful!';
            statusMessage.style.color = 'green';

        } catch (error) {
            console.error('Upload process failed:', error);
            statusMessage.textContent = `Error: ${error.message}`;
            statusMessage.style.color = 'red';
        } finally {
            // Reset the file input so the user can upload the same file again if needed
            fileUploadInput.value = '';
        }
    });
});
