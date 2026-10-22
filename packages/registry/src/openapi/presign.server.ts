import {AgentsClient, type AgentsClientOptions} from '@lingya-ai/agents-sdk';

type HmacAuth = Extract<AgentsClientOptions['auth'], {type:'hmac'}>;
export type AgentTokenHandlerOptions = Omit<AgentsClientOptions,'auth'> & {
 auth: Omit<HmacAuth,'externalUserId'>;
 /** 用户身份由接入方服务端认证产生，不接受浏览器传入的用户 ID */
 authenticate:(request:Request)=>Promise<{id:string}|null>;
};
/** 接入方业务令牌路由；签名和 /presign 请求均由服务端 SDK 执行 */
export function createAgentTokenHandler(options:AgentTokenHandlerOptions) {
 return async (request:Request):Promise<Response> => {
  const user=await options.authenticate(request);
  if(!user)return Response.json({message:'需要登录'},{status:401,headers:{'Cache-Control':'no-store'}});
  try {
   const client=new AgentsClient({baseUrl:options.baseUrl,channelId:options.channelId,fetch:options.fetch,auth:{...options.auth,externalUserId:user.id}});
   const token=await client.configuration.createOpenApiToken({signal:request.signal});
   return Response.json(token,{headers:{'Cache-Control':'no-store'}});
  } catch {
   return Response.json({message:'暂时无法获取渠道令牌'},{status:502,headers:{'Cache-Control':'no-store'}});
  }
 };
}
