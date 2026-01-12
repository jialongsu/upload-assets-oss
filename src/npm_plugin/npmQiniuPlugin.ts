/*
 * @Author: Arno.su
 * @Date: 2022-10-21 13:31:59
 * @LastEditors: Arno.su
 * @LastEditTime: 2022-10-21 17:23:43
 */
import difference from 'lodash/difference.js';
import Qiniu, { type Options } from '../oss_plugin/qiniu';
import { log } from '../utils/log';
import { getProjectName } from '../utils/utils';

let projectName = getProjectName();

class NpmQiuniuPlugin {
  options: Options;
  qiniu: Qiniu;

  constructor(options: Options) {
    this.qiniu = new Qiniu(options);
    this.options = options;
    if (options.rootName) {
      projectName = options.rootName;
    }
  }

  apply({
    filePathAry,
    outputPath,
  }: {
    filePathAry: string[];
    outputPath: string;
  }) {
    this.batchUpload(filePathAry, outputPath);
  }

  async batchUpload(filePathAry: string[], buildPath: string) {
    const { isLog } = this.options;
    const uploadData: { [key: string]: string } = {};

    filePathAry.forEach((filename) => {
      uploadData[`${projectName}/${filename}`] = `${buildPath}/${filename}`;
    });

    const uploadAry = await this.batchDelete(Object.keys(uploadData));
    const len = uploadAry.length;
    const maxIndex = len - 1;

    if (len === 0) {
      log(`😭  没有发现需要上传的文件 \n`);
      return;
    }

    log(`⬆️   将上传 ${len} 个文件`);
    uploadAry.forEach(async (key: string, i: number) => {
      const filePath = uploadData[key];

      isLog && log(`🚀  正在上传第 ${i + 1} 个文件: ${key}`);
      await this.qiniu.putFile(key, filePath);
      if (maxIndex === i) {
        log(`👏  上传完成！`);
      }
    });
  }

  async batchDelete(uploadFilePathAry: string[]) {
    const { forceDelete } = this.options;
    const resourceList = await this.qiniu.getResouceList(projectName); // 获取之前上传七牛的文件
    const deleteAry = forceDelete
      ? resourceList
      : difference(resourceList, uploadFilePathAry); // 获取需要先在七牛上删除的文件
    const uploadAry = forceDelete
      ? uploadFilePathAry
      : difference(uploadFilePathAry, resourceList); // 获取需要上传的文件

    if (deleteAry.length > 0) {
      // await this.qiniu.batchDeleteFile(deleteAry); // 删除文件
    }

    return uploadAry;
  }
}

export default NpmQiuniuPlugin;
