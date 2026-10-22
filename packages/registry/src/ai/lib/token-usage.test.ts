import {describe,expect,it} from 'vitest';
import {formatTokenRate, getCacheHitRate, type TokenUsage} from './token-usage';

describe('SDK 用量的展示格式',()=>{
 it.each([[undefined,null],[null,null],[0,'0%'],[0.625,'62.5%'],[1,'100%']])('比例 %s 显示为 %s',(value,expected)=>{
  expect(formatTokenRate(value)).toBe(expected);
 });
});

describe('缓存分项比例', () => {
 it.each([
  [51060,8448,8448/51060], [100,0,0], [100,100,1],
  [0,0,null], [100,101,null], [100,-1,null], [NaN,1,null],
 ])('观测 %s、缓存 %s 得到 %s', (observedInputTokens,cachedInputTokens,expected) => {
  expect(getCacheHitRate({inputTokenBreakdown:{observedInputTokens,cachedInputTokens}} as TokenUsage)).toBe(expected);
 });
 it('保留服务端明确提供的零比例', () => {
  expect(getCacheHitRate({cacheHitRate:0,inputTokenBreakdown:{observedInputTokens:100,cachedInputTokens:50}} as TokenUsage)).toBe(0);
 });
});
