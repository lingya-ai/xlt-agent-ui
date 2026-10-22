import {describe, expect, it} from 'vitest';
import {decodeAiChatBriefEvent, type AiChatUserQueryBriefEvent} from '@lingya-ai/agents-sdk/browser';
import {consumeChatEvent} from './consume-chat-event';
import type {ChatItem} from './types';

const event: AiChatUserQueryBriefEvent = {type:'user-query',query:'事件正文',attachments:[]};
describe('SDK 事件与 UI 消息归并', () => {
  it.each(['ASYNC_TASK_NOTIFICATION','GOAL_CONTINUATION'])('使用消息元数据中的 %s 隔离内部查询', executionType => {
    const item: ChatItem = {id:'internal',loading:true,loaded:true,user:{text:'',executionType},assistant:[]};
    const result = consumeChatEvent(item,event);
    expect(result).toEqual({...item,executionType});
    expect(JSON.stringify(result)).not.toContain(event.query);
  });
  it.each(['USER_MESSAGE','SUBAGENT','FUTURE_TYPE'])('更新 %s 正文且保留来源元数据', executionType => {
    const item:ChatItem = {id:'m',loading:true,loaded:true,user:{text:'旧正文',executionType},assistant:[]};
    const result = consumeChatEvent(item,event);
    expect(result.user).toEqual({text:event.query,attachments:[],executionType});
    expect(result.assistant).toEqual([event]);
  });
  it('未知事件即使使用 end 判别值也不会伪造消息终态', () => {
    const item:ChatItem = {id:'m',loading:true,loaded:true,assistant:[]};
    const unknown = {type:'end',rawJson:'{"type":"future-end"}'};
    const result = consumeChatEvent(item,unknown);
    expect(result.loading).toBe(true);
    expect(result.assistant).toEqual([unknown]);
  });
  it('真实 SDK 解码的未来事件保留原文且不打断相邻正文归并', () => {
    const raw = '{"type":"future-event","payload":{"value":7}}';
    let item:ChatItem = {id:'m',loading:true,loaded:true,assistant:[]};
    item = consumeChatEvent(item,{type:'message',message:'前'});
    item = consumeChatEvent(item,decodeAiChatBriefEvent(raw));
    item = consumeChatEvent(item,{type:'message',message:'后'});
    item = consumeChatEvent(item,{type:'message',message:'续'});
    expect(item.assistant).toEqual([{type:'message',message:'前'},{type:'future-event',rawJson:raw},{type:'message',message:'后续'}]);
  });
});
