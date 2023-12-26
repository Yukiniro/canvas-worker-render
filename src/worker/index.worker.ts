import { isString, uniq } from "lodash-es";

const MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/jpg", "image/webp"];

function postError(error: Error) {
  postMessage({
    type: "error",
    message: error?.message,
  });
}

async function getArrayBufferFromUrl(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return await res.arrayBuffer();
}

async function decodeImageToVideoFrame(
  imageSource: string | ArrayBuffer,
  imageType = "image/jpeg",
): Promise<VideoFrame | null> {
  const arrayBuffer = isString(imageSource) ? await getArrayBufferFromUrl(imageSource) : imageSource;

  let decodeDone = false;
  let videoFrame = null;
  const types = uniq([imageType, ...MIME_TYPES]);
  for (let i = 0; i < types.length; i++) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const decoder = new ImageDecoder({ type: types[i], data: arrayBuffer });
    try {
      let done = false;
      while (!done) {
        const { image, complete } = await decoder.decode({
          completeFramesOnly: false,
        });
        done = complete;
        videoFrame = image;
      }
      decodeDone = true;
    } catch (e) {
      // do nothing
      decodeDone = false;
      continue;
    } finally {
      decoder.close();
    }

    if (decodeDone) {
      break;
    }
  }

  return videoFrame;
}

async function decodeImage(
  imageSource: string | ArrayBuffer,
  options: { id: string; imageType: string },
): Promise<{
  id: string;
  imageSize: { width: number; height: number };
  imageBitmap: ImageBitmap;
}> {
  const { id, imageType = "image/jpeg" } = options;
  const videoFrame = await decodeImageToVideoFrame(imageSource, imageType);
  const imageSize = {
    width: videoFrame.displayWidth,
    height: videoFrame.displayHeight,
  };
  const imageBitmap = await createImageBitmap(videoFrame, {
    premultiplyAlpha: "premultiply",
  });
  videoFrame.close();
  return { id, imageSize, imageBitmap };
}

onmessage = async e => {
  try {
    const msg = e.data;
    switch (msg.type) {
      case "decodeImage": {
        const data = await decodeImage(msg.imageSource, msg.options);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        postMessage({ type: "decodeImage", data }, [data.imageBitmap]);
        break;
      }
      default:
    }
  } catch (e) {
    postError(e?.message);
  }
};
