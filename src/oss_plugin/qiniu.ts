import qiniu from 'qiniu';
import { log } from '../utils/log';

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
   * 上传文件前，先强制删除之前上传七牛云上的文件
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
  options = {
    accessKey: '',
    secretKey: '',
    bucket: '',
  };
  uploadToken: string;
  formUploader: qiniu.form_up.FormUploader;
  bucketManager: qiniu.rs.BucketManager;

  constructor(options: Options) {
    const { accessKey, secretKey, bucket } = options;
    const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    const _options = {
      scope: bucket,
    };
    const putPolicy = new qiniu.rs.PutPolicy(_options);
    const config = new qiniu.conf.Config();
    this.options = options;
    this.uploadToken = putPolicy.uploadToken(mac);
    this.formUploader = new qiniu.form_up.FormUploader(config);
    this.bucketManager = new qiniu.rs.BucketManager(mac, config);
  }

  putFile(key: string, filePath: string) {
    const putExtra = new qiniu.form_up.PutExtra();

    return new Promise((resolve, reject) => {
      this.formUploader.putFile(
        this.uploadToken,
        key,
        filePath,
        putExtra,
        function (respErr, respBody, respInfo) {
          if (respErr) {
            throw respErr;
          }
          if (respInfo.statusCode == 200) {
            resolve(respInfo);
          } else {
            console.log(respInfo.statusCode);
            console.log(respBody);
            reject(respBody);
          }
        }
      );
    });
  }

  getResouceList(prefix: string): Promise<string[]> {
    const { bucket } = this.options;

    var options = {
      // limit: 10,
      prefix,
    };

    log('🗓   正在获取历史数据...');
    return new Promise((resolve, reject) => {
      this.bucketManager.listPrefix(
        bucket,
        options,
        function (err, respBody, respInfo) {
          if (err) {
            throw err;
          }
          if (respInfo.statusCode == 200) {
            const resourceList = respBody.items.map((item: any) => item.key);
            log('👏  获取历史数据成功，正在对比文件...\n');
            resolve(resourceList);
          } else {
            console.log(respInfo.statusCode);
            console.log(respBody);
            reject(respBody);
          }
        }
      );
    });
  }

  batchDeleteFile(filenameAry: string[]) {
    const { bucket } = this.options;
    let deleteOperations: string[] = [];

    if (filenameAry && filenameAry.length > 1) {
      deleteOperations = filenameAry.map((filename) =>
        qiniu.rs.deleteOp(bucket, filename)
      );
    }

    log('🤡  正在删除文件...');
    return new Promise((resolve, reject) => {
      this.bucketManager.batch(
        deleteOperations,
        function (err, respBody, respInfo) {
          if (err) {
            reject(err);
            throw err;
          } else {
            log('👏  删除完成！\n');
            resolve(respInfo);
          }
        }
      );
    });
  }
}

export default Qiniu;
