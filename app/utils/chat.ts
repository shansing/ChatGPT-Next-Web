import {
  compressAccurately,
  dataURLtoFile,
  EImageType,
} from "image-conversion";
import { CACHE_URL_PREFIX, UPLOAD_URL } from "@/app/constant";

import { MultimodalContent, RequestMessage } from "@/app/client/api";

//ref: https://platform.openai.com/docs/guides/vision/managing-images
//ref: https://docs.anthropic.com/en/docs/vision#image-size
const MAX_SHORT_SIDE_PIXEL = 768;
const UPLOAD_IMAGE_MAX_SIZE = 256 * 1024;

export function compressImage(
  file: File | Blob,
  maxSize: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent: any) => {
      const image = new Image();
      image.onload = () => {
        const shortSidePixel =
          image.width <= image.height ? image.width : image.height;
        let scale = MAX_SHORT_SIDE_PIXEL / shortSidePixel;
        if (scale > 1) {
          scale = 1;
        }
        dataURLtoFile(image.src)
          .then((jpgFile) => {
            compressAccurately(jpgFile, {
              size: Math.floor(maxSize / 1024),
              accuracy: 0.9,
              type: EImageType.JPEG,
              orientation: 1,
              scale: scale,
            })
              .then((blob) => {
                const fr = new FileReader();
                fr.onload = function (e) {
                  resolve(e?.target?.result as string);
                };
                fr.readAsDataURL(blob);
              })
              .catch((err) => reject(err));
          })
          .catch((err) => reject(err));
      };
      image.onerror = reject;
      // console.log("readerEvent.target",readerEvent.target,readerEvent.target.result)
      image.src = readerEvent.target.result;
    };
    reader.onerror = reject;

    // console.log("file.type", file.type)
    if (
      ("name" in file && file.name.toLowerCase().endsWith(".heic")) ||
      ("name" in file && file.name.toLowerCase().endsWith(".heif")) ||
      file.type.includes("heic")
    ) {
      const heic2any = require("heic2any");
      // console.log("heic")
      heic2any({ blob: file, toType: "image/jpeg" })
        .then((blob: Blob) => {
          reader.readAsDataURL(blob);
        })
        .catch((e: any) => {
          reject(e);
        });
    } else {
      reader.readAsDataURL(file);
    }
  });
}

export async function preProcessImageContentBase(
  content: RequestMessage["content"],
  transformImageUrl: (url: string) => Promise<{ [key: string]: any }>,
) {
  if (typeof content === "string") {
    return content;
  }
  const result = [];
  for (const part of content) {
    if (part?.type == "image_url" && part?.image_url?.url) {
      try {
        const url = await cacheImageToBase64Image(part?.image_url?.url);
        result.push(await transformImageUrl(url));
      } catch (error) {
        console.error("Error processing image URL:", error);
      }
    } else {
      result.push({ ...part });
    }
  }
  return result;
}

export async function preProcessImageContent(
  content: RequestMessage["content"],
) {
  return preProcessImageContentBase(content, async (url) => ({
    type: "image_url",
    image_url: { url },
  })) as Promise<MultimodalContent[] | string>;
}

const imageCaches: Record<string, string> = {};
export function cacheImageToBase64Image(imageUrl: string) {
  if (imageUrl.includes(CACHE_URL_PREFIX)) {
    if (!imageCaches[imageUrl]) {
      const reader = new FileReader();
      return fetch(imageUrl, {
        method: "GET",
        mode: "cors",
        credentials: "include",
      })
        .then((res) => res.blob())
        .then(
          async (blob) =>
            (imageCaches[imageUrl] = await compressImage(
              blob,
              UPLOAD_IMAGE_MAX_SIZE,
            )),
        ); // compressImage
    }
    return Promise.resolve(imageCaches[imageUrl]);
  }
  return Promise.resolve(imageUrl);
}

export function base64Image2Blob(base64Data: string, contentType: string) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

export function uploadImage(file: File | Blob): Promise<string> {
  if (!window._SW_ENABLED && !navigator?.serviceWorker?.controller) {
    // if serviceWorker register error, using compressImage
    console.warn("serviceWorker register error");
    return compressImage(file, UPLOAD_IMAGE_MAX_SIZE);
  }
  const body = new FormData();
  body.append("file", file);
  return fetch(UPLOAD_URL, {
    method: "post",
    body,
    mode: "cors",
    credentials: "include",
  })
    .then((res) => res.json())
    .then((res) => {
      // console.log("res", res);
      if (res?.code == 0 && res?.data) {
        return res?.data;
      }
      throw Error(`upload Error: ${res?.msg}`);
    });
}

export function removeImage(imageUrl: string) {
  return fetch(imageUrl, {
    method: "DELETE",
    mode: "cors",
    credentials: "include",
  });
}
