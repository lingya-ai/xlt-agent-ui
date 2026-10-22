import _ from "lodash";

/**
 * 是否为空白字符串
 * @param value
 */
export const isBlank = (value: string | undefined | null): boolean => {
  return _.isUndefined(value) || _.isNull(value) || _.isEmpty(value) || _.isEmpty(value?.trim());
}
