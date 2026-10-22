import {z} from 'zod';

// =============================================================================
// 错误码常量
// =============================================================================

/**
 * 成功状态码
 */
export const SUCCESS_CODE = 'success';

/**
 * 成功消息
 */
export const SUCCESS_MESSAGE = '成功';

/**
 * 通用错误码枚举
 */
export const ErrorCode = {
  SUCCESS: SUCCESS_CODE,
  BAD_REQUEST: 'bad-request',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not-found',
  METHOD_NOT_ALLOWED: 'method-not-allowed',
  NOT_ACCEPTABLE: 'not-acceptable',
  CONFLICT: 'conflict',
  GONE: 'gone',
  REQUEST_ENTITY_TOO_LARGE: 'request-entity-too-large',
  REQUEST_URI_TOO_LONG: 'request-uri-too-long',
  UNSUPPORTED_MEDIA_TYPE: 'unsupported-media-type',
  UNPROCESSABLE_ENTITY: 'unprocessable-entity',
  INTERNAL_SERVER_ERROR: 'internal-server-error',
  SERVICE_UNAVAILABLE: 'service-unavailable',
} as const;

/**
 * 错误码类型
 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// =============================================================================
// 基础消息 Schema
// =============================================================================

/**
 * CodeMsg - 状态响应消息
 * 用途：返回操作状态（成功/失败）
 *
 * 响应示例：
 * ```json
 * {
 *   "code": "success",
 *   "message": "成功"
 * }
 * ```
 */
export const codeMsgSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type CodeMsg = z.infer<typeof codeMsgSchema>;

// =============================================================================
// 字段错误相关 Schema
// =============================================================================

/**
 * RespFieldError - 字段错误封装对象
 */
export const respFieldErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  rejectedValue: z.any().nullable().optional(),
});

export type RespFieldError = z.infer<typeof respFieldErrorSchema>;

/**
 * FieldsRespMsg - 字段错误结果体
 * 用途：返回字段级别的验证错误
 *
 * 响应示例：
 * ```json
 * {
 *   "code": "unprocessable-entity",
 *   "message": "请求参数存在语义错误",
 *   "fields": {
 *     "username": [
 *       {
 *         "code": "NotBlank",
 *         "message": "不能为空",
 *         "rejectedValue": ""
 *       }
 *     ]
 *   }
 * }
 * ```
 */
export const fieldsRespMsgSchema = z.object({
  code: z.string(),
  message: z.string(),
  fields: z.record(z.array(respFieldErrorSchema)),
});

export type FieldsRespMsg = z.infer<typeof fieldsRespMsgSchema>;

// =============================================================================
// 数据响应 Schema
// =============================================================================

/**
 * DataMsg<T> - 数据消息
 * 用途：包装单条数据（会被二次封装）
 *
 * 响应示例（自动封装后）：
 * ```json
 * {
 *   "code": "返回值本身",
 *   "message": "返回值本身"
 * }
 * ```
 */
export const dataMsgSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
  });

export type DataMsg<T> = {
  data: T;
};

// =============================================================================
// 集合响应 Schema
// =============================================================================

/**
 * RespMsg<T> - 集合结果对象
 * 用途：返回集合数据
 *
 * 响应示例：
 * ```json
 * {
 *   "records": [1, 2, 3]
 * }
 * ```
 */
export const respMsgSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    records: z.array(itemSchema),
  });

export type RespMsg<T> = {
  records: T[];
};

// =============================================================================
// 分页相关 Schema
// =============================================================================

/**
 * RespPage - 分页信息
 */
export const respPageSchema = z.object({
  current: z.number().int().describe('当前页码'),
  size: z.number().int().describe('页长度'),
  total: z.number().int().describe('总数'),
});

export type RespPage = z.infer<typeof respPageSchema>;

/**
 * PageRespMsg<T> - 分页结果消息
 * 用途：返回分页数据
 *
 * 响应示例：
 * ```json
 * {
 *   "records": [{"id": 1}, {"id": 2}],
 *   "page": {
 *     "current": 1,
 *     "size": 10,
 *     "total": 100
 *   }
 * }
 * ```
 */
export const pageRespMsgSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    records: z.array(itemSchema),
    page: respPageSchema,
  });

export type PageRespMsg<T> = {
  records: T[];
  page: RespPage;
};

// =============================================================================
// 时间字段 Schema
// =============================================================================

/**
 * 时间字段 Schema。
 *
 * 常规 HTTP 接口返回 ISO 8601 字符串；部分 SSE 事件使用 Jackson 的时间戳格式，
 * 会将 Java Instant 序列化为带小数的 Unix 秒数。这里统一转换为 ISO 8601 字符串，
 * 避免各业务 Schema 重复处理同一种传输差异。
 */
export const instantSchema = z.union([
  z.string(),
  z.number().finite().transform((value, ctx) => {
    const date = new Date(value * 1000);

    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '无效的 Unix 秒时间戳',
      });
      return z.NEVER;
    }

    return date.toISOString();
  }),
]);

/**
 * 可为空的时间字段 Schema
 */
export const nullableInstantSchema = instantSchema.nullable();

// =============================================================================
// 实用 Schema
// =============================================================================


/**
 * 空响应 Schema
 */
export const emptySchema = z.null().or(z.undefined()).or(z.object({}));

// =============================================================================
// 列表查询输入 Schema（对应后端 BaseListInput）
// =============================================================================

/**
 * 排序方向
 */
export const sortDirectionSchema = z.enum(['ASC', 'DESC']);

export type SortDirection = z.infer<typeof sortDirectionSchema>;

/**
 * 排序空值处理
 */
export const sortNullHandlingSchema = z.enum(['NATIVE', 'NULLS_FIRST', 'NULLS_LAST']);

export type SortNullHandling = z.infer<typeof sortNullHandlingSchema>;

/**
 * BaseListInput - 列表查询基础入参
 * 对应后端：cc.lingya.xiaolingtong.common.dto.BaseListInput
 *
 * 字段说明：
 * - current: 当前页码，从 0 开始，null 表示不分页
 * - size: 每页大小，默认 30，最大 1000
 * - orderBy: 排序字段名称数组
 * - orderDirection: 排序方向（ASC / DESC）
 * - orderNullHandling: 排序时空值处理方式
 * - keyword: 搜索关键字
 */
export const baseListInputSchema = z.object({
  current: z.number().int().min(0).nullable().optional().describe('当前页码，从 0 开始，null 表示不分页'),
  size: z.number().int().min(0).max(1000).optional().describe('每页大小，默认 30，最大 1000'),
  orderBy: z.array(z.string()).nullable().optional().describe('排序字段名称数组'),
  orderDirection: sortDirectionSchema.optional().describe('排序方向（ASC / DESC）'),
  orderNullHandling: sortNullHandlingSchema.optional().describe('排序空值处理（NATIVE / NULLS_FIRST / NULLS_LAST）'),
  keyword: z.string().nullable().optional().describe('搜索关键字'),
});

export type BaseListInput = z.infer<typeof baseListInputSchema>;
