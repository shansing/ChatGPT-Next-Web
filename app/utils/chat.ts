import heic2any from "heic2any";
import {
  compressAccurately,
  dataURLtoFile,
  EImageType,
} from "image-conversion";

//ref: https://platform.openai.com/docs/guides/vision/managing-images
//ref: https://docs.anthropic.com/en/docs/vision#image-size
const MAX_SHORT_SIDE_PIXEL = 768;
export function compressImage(file: File, maxSize: number): Promise<string> {
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
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif") ||
      file.type.includes("heic")
    ) {
      // console.log("heic")
      heic2any({ blob: file, toType: "image/jpeg" })
        .then((blob) => {
          reader.readAsDataURL(blob as Blob);
        })
        .catch((e) => {
          reject(e);
        });
    } else {
      reader.readAsDataURL(file);
    }
  });
}
