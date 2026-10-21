import qiniu from 'qiniu';
import path from 'path';

export interface Options {
  /**
   * 七牛 Access Key
   */
  accessKey: string;
  /**
   * 七牛 Secret Key
   */
  secretKey: string;
  /**
   * 七牛 空间名
   */
  bucket: string;
  /**
   * @deprecated 仅为兼容旧配置保留，不再删除远端文件；HTML 覆盖，其他文件重复时跳过。
   */
  forceDelete?: boolean;
  /**
   * 文件上传的根目录名称，默认为项目名称
   */
  rootName?: string;
  /**
   * 是否打印上传日志，默认为false
   */
  isLog?: boolean;
}

class Qiniu {
  options: Options;
  mac: qiniu.auth.digest.Mac;
  formUploader: qiniu.form_up.FormUploader;

  constructor(options: Options) {
    const { accessKey, secretKey } = options;
    const config = new qiniu.conf.Config();
    this.options = options;
    this.mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    this.formUploader = new qiniu.form_up.FormUploader(config);
  }

  /**
   * 上传单个文件：HTML 允许覆盖，其他文件仅新增，遇到重复文件时跳过。
   * @param key 七牛对象的完整路径，包含上传根目录和文件相对路径。
   * @param filePath 本地待上传文件的路径。
   * @returns true 表示上传成功，false 表示非 HTML 文件已存在并跳过。
   */
  putFile(key: string, filePath: string): Promise<boolean> {
    const { bucket } = this.options;
    const isHtml = path.extname(key).toLowerCase() === '.html';
    // 覆盖凭证必须绑定具体对象，不能复用只有空间名的新增凭证。
    const policyOptions = {
      scope: isHtml ? `${bucket}:${key}` : bucket,
      insertOnly: isHtml ? 0 : 1,
      // 普通仅新增策略对同名同内容仍返回成功，强制仅新增才能统一跳过重复文件。
      forceInsertOnly: !isHtml,
    };
    const putPolicy = new qiniu.rs.PutPolicy(policyOptions);
    const uploadToken = putPolicy.uploadToken(this.mac);
    const putExtra = new qiniu.form_up.PutExtra();

    return new Promise((resolve, reject) => {
      this.formUploader.putFile(
        uploadToken,
        key,
        filePath,
        putExtra,
        function (respErr, respBody, respInfo) {
          if (respErr) {
            reject(new Error(`上传失败 ${key}：${respErr.message}`));
            return;
          }
          const statusCode = respInfo?.statusCode;
          if (statusCode === 200) {
            resolve(true);
            return;
          }
          // 只忽略非 HTML 的明确重复错误，其他失败仍需反馈给构建工具。
          if (!isHtml && statusCode === 614 && respBody?.error === 'file exists') {
            resolve(false);
            return;
          }
          reject(new Error(`上传失败 ${key}（${statusCode ?? '未知状态码'}）：${respBody?.error ?? '未知错误'}`));
        }
      );
    });
  }
}

export default Qiniu;
