/*
 * @Author: Arno.su
 * @Date: 2022-10-21 13:31:59
 * @LastEditors: Arno.su
 * @LastEditTime: 2022-10-21 17:23:43
 */
import Qiniu, { type Options } from '../oss_plugin/qiniu';
import { log } from '../utils/log';
import { getProjectName } from '../utils/utils';

class NpmQiuniuPlugin {
  options: Options;
  qiniu: Qiniu;

  constructor(options: Options) {
    this.qiniu = new Qiniu(options);
    this.options = options;
  }

  apply({
    filePathAry,
    outputPath,
  }: {
    filePathAry: string[];
    outputPath: string;
  }) {
    return this.batchUpload(filePathAry, outputPath);
  }

  async batchUpload(filePathAry: string[], buildPath: string) {
    const { isLog, rootName } = this.options;
    const projectName = rootName || getProjectName();
    const len = filePathAry.length;

    if (len === 0) {
      log(`😭  没有发现需要上传的文件 \n`);
      return;
    }

    log(`⬆️   将上传 ${len} 个文件`);
    let successCount = 0;
    let skippedCount = 0;
    const failures: string[] = [];
    // 逐个等待上传，接住每个 Promise，并避免 SDK 并发清理区域缓存时的锁冲突。
    for (const [i, filename] of filePathAry.entries()) {
      const key = `${projectName}/${filename}`;
      const filePath = `${buildPath}/${filename}`;
      isLog && log(`🚀  正在上传第 ${i + 1} 个文件: ${key}`);
      try {
        if (await this.qiniu.putFile(key, filePath)) {
          successCount += 1;
        } else {
          skippedCount += 1;
          isLog && log(`⏭️  文件已存在，跳过: ${key}`);
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `上传失败 ${key}：${String(error)}`);
      }
    }
    log(`上传结果：成功 ${successCount}，跳过 ${skippedCount}，失败 ${failures.length}`,
      failures.length > 0 ? 'red' : 'green');
    if (failures.length > 0) {
      throw new Error(failures.join('\n'));
    }
    log('👏  上传完成！');
  }
}

export default NpmQiuniuPlugin;
