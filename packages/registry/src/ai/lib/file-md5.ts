import {md5} from 'js-md5';

/**
 * 生成文件的 MD5 Base64 编码值
 */
export async function fileMd5(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(file);

    fileReader.onerror = (e) => {
      reject(e);
    };

    fileReader.onload = (e) => {
      try {
        const arrayBuffer = e.target!.result!;
        const hashBuffer = md5.arrayBuffer(arrayBuffer);
        resolve(btoa(String.fromCharCode(...new Uint8Array(hashBuffer))));
      } catch (e) {
        reject(e);
      }
    };
  });
}
