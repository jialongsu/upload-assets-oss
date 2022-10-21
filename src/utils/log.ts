/*
 * @Author: Arno.su
 * @Date: 2021-11-24 16:59:07
 * @LastEditors: Arno.su
 * @LastEditTime: 2022-10-21 12:10:31
 */
import chalk from 'chalk';

export const log = (text: string, color = 'green') => {
  console.log((chalk as any)[color](text));
};
