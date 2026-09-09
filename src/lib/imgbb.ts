export interface ImgBBUploadResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: string;
    height: string;
    size: number;
    time: string;
    expiration: string;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

/**
 * Uploads an image file to ImgBB using the provided API Key.
 * @param file The image File to upload
 * @param apiKey ImgBB API Key
 * @returns The direct public URL of the uploaded image
 */
export async function uploadImageToImgBB(file: File, apiKey: string): Promise<string> {
  const trimmedKey = apiKey?.trim();
  if (!trimmedKey) {
    throw new Error('La API Key de ImgBB no está configurada. Por favor, ingrésala en Ajustes.');
  }

  // Validate that it is an image
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen válida.');
  }

  // ImgBB free limit is 32MB, but let's warn if too big
  if (file.size > 32 * 1024 * 1024) {
    throw new Error('La imagen excede el límite permitido de 32MB.');
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(trimmedKey)}`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      const errorMsg = result.error?.message || `Error del servidor (${response.status})`;
      if (errorMsg.toLowerCase().includes('api key') || result.status_code === 400) {
        throw new Error(`Error en ImgBB: ${errorMsg}`);
      }
      throw new Error(`No se pudo subir la imagen: ${errorMsg}`);
    }

    // Prefer display_url or url
    return result.data.display_url || result.data.url;
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('No se pudo conectar con el servidor de ImgBB. Revisa tu conexión a internet.');
    }
    throw error;
  }
}
