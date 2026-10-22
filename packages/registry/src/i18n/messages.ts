// 来源字典的一次性转换；后续直接维护此双语数据
export const messages = {
  "goal-demo": {
  "title": {
    "locales": {
      "zh": "目标模式",
      "en": "Goal lifecycle"
    }
  },
  "objective": {
    "locales": {
      "zh": "目标正文",
      "en": "Objective"
    }
  },
  "description": {
    "locales": {
      "zh": "通过目标组件管理当前会话的目标及历史",
      "en": "Manage the conversation goal and history with the goal components"
    }
  },
  "simulation": {
    "locales": {
      "zh": "本地模拟目标控制和历史，不执行真实 Agent 任务",
      "en": "Simulated goal controls and history; no real Agent tasks are executed"
    }
  },
  "placeholder": {
    "locales": {
      "zh": "例如：整理本季度销售数据并输出分析报告",
      "en": "For example: analyze quarterly sales and prepare a report"
    }
  },
  "create": {
    "locales": {
      "zh": "创建目标",
      "en": "Create goal"
    }
  },
  "creating": {
    "locales": {
      "zh": "正在创建",
      "en": "Creating"
    }
  },
  "created": {
    "locales": {
      "zh": "目标已创建",
      "en": "Goal created"
    }
  },
  "refresh": {
    "locales": {
      "zh": "刷新目标",
      "en": "Refresh goal"
    }
  },
  "unsupported": {
    "locales": {
      "zh": "当前渠道未启用目标能力",
      "en": "Goal mode is unavailable for this channel"
    }
  }
},
  "optional-capabilities": {
    "previewUnavailable": {"locales":{"zh":"安装文件预览能力后可在此查看文件","en":"Install file previews to view this file"}},
    "download": {"locales":{"zh":"下载文件","en":"Download file"}},
    "downloadError": {"locales":{"zh":"文件下载失败","en":"File download failed"}},
    "chartUnavailable": {"locales":{"zh":"安装图表能力后可显示图表，当前可查看数据表","en":"Install charts to render this chart, or view the data table"}},
    "showTable": {"locales":{"zh":"查看数据表","en":"View data table"}}
  },
  "agent-goal-bar": {
    "edit": {
      "locales": {
        "zh": "编辑目标",
        "en": "Edit goal"
      }
    },
    "editDescription": {
      "locales": {
        "zh": "修改目标内容，保存后生效",
        "en": "Edit the objective and save to apply changes"
      }
    }
  },
  "agent-goal-clear": {
    "title": {
      "locales": {
        "zh": "清除目标",
        "en": "Clear goal"
      }
    },
    "description": {
      "locales": {
        "zh": "清除后会保留目标历史，待处理的人工请求将失效，已经准入的执行轮可能继续至结束",
        "en": "History is retained and pending requests become invalid; an admitted round may still finish"
      }
    },
    "cancel": {
      "locales": {
        "zh": "取消",
        "en": "Cancel"
      }
    },
    "confirm": {
      "locales": {
        "zh": "清除",
        "en": "Clear"
      }
    },
    "cleared": {
      "locales": {
        "zh": "目标已清除",
        "en": "Goal cleared"
      }
    }
  },
  "agent-goal-details": {
    "title": {
      "locales": {
        "zh": "目标详情与历史",
        "en": "Goal details and history"
      }
    },
    "description": {
      "locales": {
        "zh": "查看目标状态和执行历史",
        "en": "View goal status and execution history"
      }
    },
    "disabled": {
      "locales": {
        "zh": "自动续跑未启用",
        "en": "Automatic continuation is disabled"
      }
    },
    "edit": {
      "locales": {
        "zh": "编辑目标",
        "en": "Edit goal"
      }
    },
    "noCurrent": {
      "locales": {
        "zh": "当前没有目标",
        "en": "No current goal"
      }
    },
    "failed": {
      "locales": {
        "zh": "读取失败，已显示的内容可能不是最新状态",
        "en": "Loading failed; displayed content may be outdated"
      }
    },
    "retry": {
      "locales": {
        "zh": "重试",
        "en": "Retry"
      }
    },
    "history": {
      "locales": {
        "zh": "目标历史",
        "en": "Goal history"
      }
    },
    "blockedReason": {
      "locales": {
        "zh": "受阻原因",
        "en": "Blocked reason"
      }
    },
    "limit": {
      "locales": {
        "zh": "显示最近 20 条记录",
        "en": "Showing the latest 20 records"
      }
    },
    "noHistory": {
      "locales": {
        "zh": "暂无目标历史",
        "en": "No goal history"
      }
    },
    "cleared": {
      "locales": {
        "zh": "已清除",
        "en": "Cleared"
      }
    },
    "replaced": {
      "locales": {
        "zh": "已替换",
        "en": "Replaced"
      }
    },
    "current": {
      "locales": {
        "zh": "当前记录",
        "en": "Current record"
      }
    }
  },
  "agent-goal-form": {
    "objective": {
      "locales": {
        "zh": "目标内容",
        "en": "Objective"
      }
    },
    "characterCount": {
      "locales": {
        "zh": "{{count}} / 4000 字",
        "en": "{{count}} / 4000 characters"
      },
      "insert": true
    },
    "objectiveRequired": {
      "locales": {
        "zh": "请输入目标内容",
        "en": "Enter an objective"
      }
    },
    "objectiveTooLong": {
      "locales": {
        "zh": "目标不能超过 4000 字",
        "en": "Objective must be at most 4000 characters"
      }
    },
    "cancel": {
      "locales": {
        "zh": "取消",
        "en": "Cancel"
      }
    },
    "save": {
      "locales": {
        "zh": "保存",
        "en": "Save"
      }
    },
    "saving": {
      "locales": {
        "zh": "保存中",
        "en": "Saving"
      }
    },
    "saved": {
      "locales": {
        "zh": "目标已保存",
        "en": "Goal saved"
      }
    },
    "saveAndStart": {
      "locales": {
        "zh": "保存并启动",
        "en": "Save and start"
      }
    },
    "savingAndStarting": {
      "locales": {
        "zh": "保存并启动中",
        "en": "Saving and starting"
      }
    },
    "savedAndStarted": {
      "locales": {
        "zh": "目标已保存并启动",
        "en": "Goal saved and started"
      }
    },
    "savedButStartFailed": {
      "locales": {
        "zh": "目标已保存，但启动失败，请重试",
        "en": "Goal saved, but starting failed; please retry"
      }
    }
  },
  "agent-goal-status": {
    "complete": {
      "locales": {
        "zh": "已完成",
        "en": "Complete"
      }
    },
    "blocked": {
      "locales": {
        "zh": "已阻塞",
        "en": "Blocked"
      }
    },
    "paused": {
      "locales": {
        "zh": "已暂停",
        "en": "Paused"
      }
    },
    "armed": {
      "locales": {
        "zh": "已激活",
        "en": "Armed"
      }
    },
    "disarmed": {
      "locales": {
        "zh": "等待恢复",
        "en": "Waiting to resume"
      }
    }
  },
  "agent-goal-toggle": {
    "pause": {
      "locales": {
        "zh": "暂停目标",
        "en": "Pause goal"
      }
    },
    "resume": {
      "locales": {
        "zh": "恢复目标",
        "en": "Resume goal"
      }
    },
    "paused": {
      "locales": {
        "zh": "目标已暂停",
        "en": "Goal paused"
      }
    },
    "resumed": {
      "locales": {
        "zh": "目标已恢复",
        "en": "Goal resumed"
      }
    }
  },
  "agent-model-selector": {
    "placeholder": {
      "locales": {
        "en": "Select model...",
        "zh": "请选择模型..."
      }
    },
    "searchMaker": {
      "locales": {
        "en": "Search makers...",
        "zh": "搜索厂商..."
      }
    },
    "noMakers": {
      "locales": {
        "en": "No makers available",
        "zh": "暂无厂商"
      }
    },
    "searchModel": {
      "locales": {
        "en": "Search models...",
        "zh": "搜索模型..."
      }
    },
    "noModels": {
      "locales": {
        "en": "No models available",
        "zh": "暂无模型"
      }
    }
  },
  "agents-chat": {
    "storageError": {
      "locales": {
        "zh": "无法保存消息展示偏好",
        "en": "Unable to save message view preference"
      }
    },
    "storageErrorDescription": {
      "locales": {
        "zh": "已保留本次选择，刷新页面后可能恢复默认模式",
        "en": "Your selection is kept for this session but may reset after refreshing"
      }
    },
    "sendMessageFailed": {
      "locales": {
        "en": "Failed to send message, please try again later",
        "zh": "发送消息失败，请稍后重试"
      }
    },
    "startConversation": {
      "locales": {
        "en": "Start conversation",
        "zh": "开始对话"
      }
    },
    "startConversationDesc": {
      "locales": {
        "en": "Type a message below to start chatting",
        "zh": "在下方输入框中输入消息开始聊天"
      }
    },
    "configUnavailableTitle": {
      "locales": {
        "en": "AI assistant unavailable",
        "zh": "AI 助手不可用"
      }
    },
    "configUnavailableDescription": {
      "locales": {
        "en": "The AI assistant configuration could not be loaded. Please try again later",
        "zh": "无法加载 AI 助手配置，请稍后重试"
      }
    },
    "retryConfig": {
      "locales": {
        "en": "Try again",
        "zh": "重试"
      }
    },
    "streamTransportPreferenceSaveFailed": {
      "locales": {
        "en": "Unable to save the reply transport preference",
        "zh": "无法保存回复传输协议偏好"
      }
    }
  },
  "agents-chat-async-tasks": {
    "title": {
      "locales": {
        "en": "Async tasks ({{count}})",
        "zh": "异步任务（{{count}}）"
      },
      "insert": true
    },
    "notificationStatusLabel": {
      "locales": {
        "en": "Agent notification",
        "zh": "Agent 通知"
      }
    },
    "trackingSuspended": {
      "locales": {
        "en": "Tracking paused",
        "zh": "状态跟踪已暂停"
      }
    },
    "trackingPaused": {
      "locales": {
        "en": "Tracking paused",
        "zh": "跟踪暂停"
      }
    },
    "notificationFailed": {
      "locales": {
        "en": "Notification failed",
        "zh": "通知失败"
      }
    },
    "taskStatuses": {
      "SUBMITTING": {
        "locales": {
          "en": "Submitting",
          "zh": "提交中"
        }
      },
      "PENDING": {
        "locales": {
          "en": "Pending",
          "zh": "等待执行"
        }
      },
      "RUNNING": {
        "locales": {
          "en": "Running",
          "zh": "执行中"
        }
      },
      "COMPLETED": {
        "locales": {
          "en": "Completed",
          "zh": "已完成"
        }
      },
      "FAILED": {
        "locales": {
          "en": "Failed",
          "zh": "失败"
        }
      },
      "CANCELLED": {
        "locales": {
          "en": "Cancelled",
          "zh": "已取消"
        }
      }
    },
    "notificationStatuses": {
      "WAITING": {
        "locales": {
          "en": "Waiting for result",
          "zh": "等待结果"
        }
      },
      "PENDING": {
        "locales": {
          "en": "Pending delivery",
          "zh": "待投递"
        }
      },
      "QUEUED": {
        "locales": {
          "en": "Waiting for consumption",
          "zh": "等待消费"
        }
      },
      "DELIVERED": {
        "locales": {
          "en": "Consumed",
          "zh": "已消费"
        }
      },
      "FAILED": {
        "locales": {
          "en": "Failed",
          "zh": "失败"
        }
      },
      "NOT_REQUIRED": {
        "locales": {
          "en": "Not required",
          "zh": "无需通知"
        }
      }
    }
  },
  "agents-chat-input": {
    "planMode": {
      "locales": {
        "en": "Plan",
        "zh": "计划"
      }
    },
    "goalMode": {
      "locales": {
        "en": "Goal",
        "zh": "目标"
      }
    },
    "disablePlanMode": {
      "locales": {
        "en": "Turn off plan mode",
        "zh": "关闭计划模式"
      }
    },
    "disableGoalMode": {
      "locales": {
        "en": "Turn off goal mode",
        "zh": "关闭目标模式"
      }
    },
    "modeForNextMessage": {
      "locales": {
        "en": "Mode for the next message",
        "zh": "下一条消息的模式"
      }
    },
    "openMenu": {
      "locales": {
        "en": "Actions and capabilities (/)",
        "zh": "操作与能力（/）"
      }
    },
    "workspace": {
      "locales": {
        "en": "Workspace",
        "zh": "工作区"
      }
    },
    "viewGroup": {
      "locales": {
        "en": "Message view",
        "zh": "消息视图"
      }
    },
    "compactView": {
      "locales": {
        "en": "Key content",
        "zh": "重点内容"
      }
    },
    "fullView": {
      "locales": {
        "en": "Full process",
        "zh": "完整过程"
      }
    },
    "conversationGroup": {
      "locales": {
        "en": "Conversation",
        "zh": "会话"
      }
    },
    "goalLoadFailed": {
      "locales": {
        "en": "Goal and message synchronization failed",
        "zh": "目标或消息同步失败"
      }
    },
    "goalRetry": {
      "locales": {
        "en": "Retry",
        "zh": "重试"
      }
    },
    "addAttachment": {
      "locales": {
        "en": "Attachment",
        "zh": "附件"
      }
    },
    "attachmentCountLimit": {
      "locales": {
        "en": "You can attach up to {{count}} files per message",
        "zh": "每条消息最多添加 {{count}} 个附件"
      },
      "insert": true
    },
    "thinking": {
      "locales": {
        "en": "Thinking",
        "zh": "深度思考"
      }
    },
    "newConversation": {
      "locales": {
        "en": "New conversation",
        "zh": "新对话"
      }
    },
    "stopGeneration": {
      "locales": {
        "en": "Stop generation",
        "zh": "停止生成"
      }
    },
    "fileUploadError": {
      "locales": {
        "en": "File upload failed, please try again",
        "zh": "文件上传失败，请重试"
      }
    },
    "attachmentFileNameTooLong": {
      "locales": {
        "en": "Filename exceeds 255 UTF-8 bytes; rename it and try again",
        "zh": "文件名超过 255 个 UTF-8 字节，请重命名后重试"
      }
    },
    "pastedImageFileNameShortened": {
      "locales": {
        "en": "Pasted image filename shortened",
        "zh": "已缩短粘贴图片的文件名"
      }
    },
    "moreAttachments": {
      "locales": {
        "en": "... +{{count}}",
        "zh": "... +{{count}} 个"
      },
      "insert": true
    },
    "allAttachments": {
      "locales": {
        "en": "All files ({{count}})",
        "zh": "全部文件（{{count}}）"
      },
      "insert": true
    },
    "viewAllAttachments": {
      "locales": {
        "en": "View all {{count}} files",
        "zh": "查看全部 {{count}} 个文件"
      },
      "insert": true
    },
    "noSuggestionItems": {
      "locales": {
        "en": "No capabilities available",
        "zh": "暂无可用能力"
      }
    },
    "noSuggestionResults": {
      "locales": {
        "en": "No matching capabilities",
        "zh": "没有匹配的能力"
      }
    },
    "suggestionListLabel": {
      "locales": {
        "en": "Capability suggestions",
        "zh": "能力建议"
      }
    },
    "contextGroup": {
      "locales": {
        "en": "Context",
        "zh": "上下文"
      }
    },
    "compactContext": {
      "locales": {
        "en": "Compact context",
        "zh": "压缩上下文"
      }
    },
    "contextUsageLoading": {
      "locales": {
        "en": "Loading",
        "zh": "读取中"
      }
    },
    "contextUnavailable": {
      "locales": {
        "en": "--",
        "zh": "--"
      }
    },
    "noContext": {
      "locales": {
        "en": "No context yet",
        "zh": "暂无上下文"
      }
    },
    "waitForGeneration": {
      "locales": {
        "en": "Available after generation",
        "zh": "生成结束后可压缩"
      }
    },
    "compactContextTitle": {
      "locales": {
        "en": "Compact conversation context?",
        "zh": "压缩当前会话上下文？"
      }
    },
    "compactContextDescription": {
      "locales": {
        "en": "Current usage is {{percentage}}. Earlier context will be summarized and some details may be omitted",
        "zh": "当前上下文使用率为 {{percentage}}，较早内容将被归纳为摘要，部分细节可能会遗漏"
      },
      "insert": true
    },
    "compactContextCancel": {
      "locales": {
        "en": "Cancel",
        "zh": "取消"
      }
    },
    "compactContextConfirm": {
      "locales": {
        "en": "Compact",
        "zh": "确认压缩"
      }
    },
    "compactingContext": {
      "locales": {
        "en": "Compacting",
        "zh": "正在压缩"
      }
    },
    "compactContextSucceeded": {
      "locales": {
        "en": "Context compacted",
        "zh": "上下文已压缩"
      }
    },
    "compactContextFailed": {
      "locales": {
        "en": "Failed to compact context",
        "zh": "上下文压缩失败，请重试"
      }
    }
  },
  "agents-chat-message": {
    "storageError": {
      "locales": {
        "zh": "无法保存消息展示偏好",
        "en": "Unable to save message view preference"
      }
    },
    "storageErrorDescription": {
      "locales": {
        "zh": "已保留本次选择，刷新页面后可能恢复默认模式",
        "en": "Your selection is kept for this session but may reset after refreshing"
      }
    },
    "asyncFollowup": {
      "locales": {
        "en": "Async task follow-up",
        "zh": "异步任务后续回复"
      }
    },
    "goalContinuation": {
      "locales": {
        "en": "Goal continuation",
        "zh": "目标续跑"
      }
    },
    "copied": {
      "locales": {
        "en": "Copied to clipboard",
        "zh": "已复制到剪贴板"
      }
    },
    "copyFailed": {
      "locales": {
        "en": "Copy failed",
        "zh": "复制失败"
      }
    },
    "copyReply": {
      "locales": {
        "en": "Copy reply",
        "zh": "复制回复"
      }
    },
    "scrollToBottom": {
      "locales": {
        "en": "Scroll to bottom",
        "zh": "回到底部"
      }
    },
    "expandUserMessage": {
      "locales": {
        "en": "Expand",
        "zh": "展开"
      }
    },
    "collapseUserMessage": {
      "locales": {
        "en": "Collapse",
        "zh": "收起"
      }
    },
    "compressContext": {
      "locales": {
        "en": "Compress context",
        "zh": "压缩上下文"
      }
    },
    "compressingContext": {
      "locales": {
        "en": "Compressing context...",
        "zh": "上下文压缩中..."
      }
    },
    "messageLoading": {
      "locales": {
        "en": "Loading content...",
        "zh": "内容加载中..."
      }
    },
    "working": {
      "locales": {
        "en": "Working...",
        "zh": "执行中..."
      }
    },
    "workingThinking": {
      "locales": {
        "en": "Thinking...",
        "zh": "正在思考..."
      }
    },
    "workingExecutingTools": {
      "locales": {
        "en": "Running tools...",
        "zh": "正在执行中..."
      }
    },
    "workingCompressingContext": {
      "locales": {
        "en": "Compressing context...",
        "zh": "正在压缩上下文..."
      }
    },
    "hiddenToolsRunning": {
      "locales": {
        "en": "Running {{count}} tools",
        "zh": "正在执行 {{count}} 个工具"
      },
      "insert": true
    },
    "hiddenToolsCompleted": {
      "locales": {
        "en": "Executed {{count}} tools",
        "zh": "已执行 {{count}} 个工具"
      },
      "insert": true
    },
    "additionalToolsRunning": {
      "locales": {
        "en": "Running {{count}} more tools",
        "zh": "另有 {{count}} 个工具正在执行"
      },
      "insert": true
    },
    "additionalToolsCompleted": {
      "locales": {
        "en": "Executed {{count}} more tools",
        "zh": "另执行 {{count}} 个工具"
      },
      "insert": true
    },
    "hiddenToolsMore": {
      "locales": {
        "en": "{{count}} more tools",
        "zh": "另外 {{count}} 个工具"
      },
      "insert": true
    },
    "chatClientRequest": {
      "locales": {
        "en": "Sent {{count}} messages to the model",
        "zh": "已向模型发送 {{count}} 条消息"
      },
      "insert": true
    },
    "chatClientResponse": {
      "locales": {
        "en": "Received {{count}} model messages",
        "zh": "已收到模型返回的 {{count}} 条消息"
      },
      "insert": true
    },
    "interrupted": {
      "locales": {
        "en": "Interrupted",
        "zh": "已中断"
      }
    },
    "interruptedDescription": {
      "locales": {
        "en": "Generation stopped",
        "zh": "生成已停止"
      }
    },
    "queued": {
      "locales": {
        "en": "Queued",
        "zh": "排队中"
      }
    },
    "cancelQueued": {
      "locales": {
        "en": "Cancel",
        "zh": "取消排队"
      }
    },
    "cancelled": {
      "locales": {
        "en": "Cancelled before execution",
        "zh": "已在执行前取消"
      }
    },
    "cancelQueuedFailed": {
      "locales": {
        "en": "Failed to cancel queued message",
        "zh": "取消排队消息失败"
      }
    },
    "artifactsTitle": {
      "locales": {
        "en": "Artifacts",
        "zh": "产出制品"
      }
    },
    "artifactsSubtitle": {
      "locales": {
        "en": "Generated by agent",
        "zh": "由智能体生成"
      }
    },
    "artifactsCount": {
      "locales": {
        "en": "{{count}} items",
        "zh": "{{count}} 个"
      },
      "insert": true
    },
    "artifactFullscreen": {
      "locales": {
        "en": "Fullscreen",
        "zh": "全屏查看"
      }
    },
    "artifactDownload": {
      "locales": {
        "en": "Download",
        "zh": "下载"
      }
    },
    "artifactDownloadFailed": {
      "locales": {
        "en": "Download failed",
        "zh": "下载失败"
      }
    },
    "artifactPreviewHint": {
      "locales": {
        "en": "Click to preview",
        "zh": "点击预览"
      }
    },
    "artifactHtmlPage": {
      "locales": {
        "en": "Web page",
        "zh": "网页"
      }
    },
    "compactorWarningDegradeTitle": {
      "locales": {
        "en": "Context compacted",
        "zh": "上下文已压缩"
      }
    },
    "compactorWarningLockedTitle": {
      "locales": {
        "en": "Auto-compact paused",
        "zh": "自动压缩已暂停"
      }
    }
  },
  "agents-chat-queue": {
    "title": {
      "locales": {
        "en": "Queued messages ({{count}})",
        "zh": "排队消息（{{count}}）"
      },
      "insert": true
    },
    "attachmentOnly": {
      "locales": {
        "en": "Message with {{count}} attachments",
        "zh": "包含 {{count}} 个附件的消息"
      },
      "insert": true
    },
    "emptyMessage": {
      "locales": {
        "en": "Empty message",
        "zh": "空消息"
      }
    },
    "cancel": {
      "locales": {
        "en": "Cancel queued message",
        "zh": "取消排队消息"
      }
    },
    "cancelFailed": {
      "locales": {
        "en": "Failed to cancel queued message",
        "zh": "取消排队消息失败"
      }
    }
  },
  "agents-chat-subagents": {
    "title": {
      "locales": {
        "zh": "子智能体 · {{count}}",
        "en": "Subagents · {{count}}"
      },
      "insert": true
    },
    "active": {
      "locales": {
        "zh": "{{count}} 个执行中",
        "en": "{{count}} active"
      },
      "insert": true
    },
    "unread": {
      "locales": {
        "zh": "有未读结果",
        "en": "Unread results"
      }
    },
    "open": {
      "locales": {
        "zh": "在工作区查看子智能体",
        "en": "View subagents in workspace"
      }
    }
  },
  "agents-conversation-replay": {
    "loadingHistory": {
      "locales": {
        "en": "Preparing conversation replay",
        "zh": "正在准备会话回放"
      }
    },
    "loadingMessages": {
      "locales": {
        "en": "Loaded {{loaded}} of {{total}} messages",
        "zh": "已加载 {{loaded}} / {{total}} 条消息"
      },
      "insert": true
    },
    "loadingEvents": {
      "locales": {
        "en": "Loaded execution steps for {{loaded}} of {{total}} messages",
        "zh": "已加载 {{loaded}} / {{total}} 条消息的执行步骤"
      },
      "insert": true
    },
    "loadFailed": {
      "locales": {
        "en": "Unable to load conversation replay",
        "zh": "会话回放加载失败"
      }
    },
    "loadFailedDescription": {
      "locales": {
        "en": "The shared history may still be preparing. Please try again",
        "zh": "分享历史可能仍在准备中，请稍后重试"
      }
    },
    "retry": {
      "locales": {
        "en": "Retry",
        "zh": "重试"
      }
    },
    "emptyTitle": {
      "locales": {
        "en": "No conversation history",
        "zh": "暂无会话历史"
      }
    },
    "emptyDescription": {
      "locales": {
        "en": "This shared conversation does not contain any replayable messages",
        "zh": "该分享会话中暂时没有可回放的消息"
      }
    }
  },
  "agents-conversation-replay-controls": {
    "play": {
      "locales": {
        "en": "Play",
        "zh": "播放"
      }
    },
    "pause": {
      "locales": {
        "en": "Pause",
        "zh": "暂停"
      }
    },
    "restart": {
      "locales": {
        "en": "Replay",
        "zh": "重新回放"
      }
    },
    "revealAll": {
      "locales": {
        "en": "Show all",
        "zh": "查看全部"
      }
    },
    "speed": {
      "locales": {
        "en": "Playback speed",
        "zh": "播放速度"
      }
    },
    "preparing": {
      "locales": {
        "en": "Preparing",
        "zh": "准备中"
      }
    },
    "playing": {
      "locales": {
        "en": "Playing",
        "zh": "回放中"
      }
    },
    "paused": {
      "locales": {
        "en": "Paused",
        "zh": "已暂停"
      }
    },
    "completed": {
      "locales": {
        "en": "Completed",
        "zh": "回放完成"
      }
    }
  },
  "ai-chat-access": {
    "denied": {
      "locales": {
        "zh": "当前操作权限不足，请联系管理员",
        "en": "You do not have permission for this action. Contact an administrator"
      }
    }
  },
  "ai-conversation-archive-controls": {
    "archiveSuccess": {
      "locales": {
        "zh": "会话已归档",
        "en": "Conversation archived"
      }
    },
    "restoreSuccess": {
      "locales": {
        "zh": "会话已取消归档",
        "en": "Conversation unarchived"
      }
    },
    "loadMore": {
      "locales": {
        "zh": "展开其余 {{count}} 个会话",
        "en": "Show {{count}} remaining conversations"
      },
      "insert": true
    }
  },
  "ai-conversation-archive-menu-item": {
    "archive": {
      "locales": {
        "zh": "归档",
        "en": "Archive"
      }
    },
    "restore": {
      "locales": {
        "zh": "取消归档",
        "en": "Unarchive"
      }
    }
  },
  "ai-conversation-archive-notice": {
    "notice": {
      "locales": {
        "zh": "此会话已归档，仅可查看历史消息",
        "en": "This conversation is archived and its history is read-only"
      }
    },
    "restore": {
      "locales": {
        "zh": "取消归档",
        "en": "Unarchive"
      }
    }
  },
  "ai-conversation-archived-badge": {
    "archived": {
      "locales": {
        "zh": "已归档",
        "en": "Archived"
      }
    }
  },
  "ai-conversation-lifecycle": {
    "restoreSuccess": {
      "locales": {
        "zh": "会话已取消归档",
        "en": "Conversation unarchived"
      }
    }
  },
  "ai-conversation-lifecycle-unavailable": {
    "retry": {
      "locales": {
        "zh": "重试",
        "en": "Retry"
      }
    },
    "unavailable": {
      "locales": {
        "zh": "暂时无法确认会话状态，请刷新后重试",
        "en": "Conversation status is unavailable, please refresh and retry"
      }
    }
  },
  "ai-conversation-list": {
    "listTitle": {
      "locales": {
        "en": "Conversations",
        "zh": "会话列表"
      }
    },
    "newConversation": {
      "locales": {
        "en": "New Conversation",
        "zh": "新对话"
      }
    },
    "pendingConversation": {
      "locales": {
        "en": "New conversation",
        "zh": "新会话"
      }
    },
    "noConversations": {
      "locales": {
        "en": "No conversations yet",
        "zh": "暂无会话"
      }
    },
    "untitled": {
      "locales": {
        "en": "Untitled",
        "zh": "未命名对话"
      }
    },
    "deleteConversation": {
      "locales": {
        "en": "Delete",
        "zh": "删除"
      }
    },
    "deleteConfirmTitle": {
      "locales": {
        "en": "Delete Conversation",
        "zh": "删除会话"
      }
    },
    "deleteConfirmDesc": {
      "locales": {
        "en": "This action cannot be undone",
        "zh": "删除后不可恢复"
      }
    },
    "deleteSuccess": {
      "locales": {
        "en": "Conversation deleted",
        "zh": "会话已删除"
      }
    },
    "cancel": {
      "locales": {
        "en": "Cancel",
        "zh": "取消"
      }
    },
    "allGroups": {
      "locales": {
        "en": "All",
        "zh": "全部"
      }
    },
    "ungrouped": {
      "locales": {
        "en": "Ungrouped",
        "zh": "未分组"
      }
    },
    "newGroup": {
      "locales": {
        "en": "New group",
        "zh": "新建分组"
      }
    },
    "createGroup": {
      "locales": {
        "en": "Create group",
        "zh": "创建分组"
      }
    },
    "renameConversation": {
      "locales": {
        "en": "Rename",
        "zh": "重命名"
      }
    },
    "groupConversation": {
      "locales": {
        "en": "Group",
        "zh": "分组"
      }
    },
    "moreActions": {
      "locales": {
        "en": "More actions",
        "zh": "更多操作"
      }
    },
    "pinConversation": {
      "locales": {
        "en": "Pin",
        "zh": "置顶"
      }
    },
    "unpinConversation": {
      "locales": {
        "en": "Unpin",
        "zh": "取消置顶"
      }
    },
    "moveToGroup": {
      "locales": {
        "en": "Move to group",
        "zh": "移动到分组"
      }
    },
    "loadMore": {
      "locales": {
        "en": "Load more",
        "zh": "加载更多"
      }
    },
    "groupsLoadFailed": {
      "locales": {
        "en": "Could not load folders",
        "zh": "分组加载失败"
      }
    },
    "retryLoadGroups": {
      "locales": {
        "en": "Retry",
        "zh": "重试"
      }
    },
    "renameGroup": {
      "locales": {
        "en": "Rename group",
        "zh": "重命名分组"
      }
    },
    "deleteGroup": {
      "locales": {
        "en": "Delete group",
        "zh": "删除分组"
      }
    },
    "deleteGroupConfirm": {
      "locales": {
        "en": "Conversations in this group will move to ungrouped.",
        "zh": "删除分组后，其中的会话将移回未分组。"
      }
    },
    "nameDialogDescription": {
      "locales": {
        "en": "Enter a name to continue",
        "zh": "输入名称后继续"
      }
    },
    "nameLabel": {
      "locales": {
        "en": "Name",
        "zh": "名称"
      }
    },
    "save": {
      "locales": {
        "en": "Save",
        "zh": "保存"
      }
    },
    "saving": {
      "locales": {
        "en": "Saving",
        "zh": "保存中"
      }
    },
    "saved": {
      "locales": {
        "en": "Saved",
        "zh": "已保存"
      }
    },
    "expandFolder": {
      "locales": {
        "en": "Expand folder",
        "zh": "展开文件夹"
      }
    },
    "collapseFolder": {
      "locales": {
        "en": "Collapse folder",
        "zh": "折叠文件夹"
      }
    },
    "dragConversation": {
      "locales": {
        "en": "Draggable conversation",
        "zh": "可拖动会话"
      }
    }
  },
  "ai-conversation-status-filter": {
    "view": {
      "locales": {
        "zh": "会话状态",
        "en": "Conversation status"
      }
    },
    "active": {
      "locales": {
        "zh": "正常",
        "en": "Active"
      }
    },
    "all": {
      "locales": {
        "zh": "正常+归档",
        "en": "Active + archived"
      }
    },
    "archivedOnly": {
      "locales": {
        "zh": "仅归档",
        "en": "Archived only"
      }
    }
  },
  "ask": {
    "timeout": {
      "locales": {
        "en": "Timeout",
        "zh": "已超时"
      }
    },
    "submit": {
      "locales": {
        "en": "Submit",
        "zh": "提交"
      }
    },
    "submitting": {
      "locales": {
        "en": "Submitting",
        "zh": "提交中"
      }
    },
    "recommended": {
      "locales": {
        "en": "Recommended",
        "zh": "推荐"
      }
    },
    "copyOption": {
      "locales": {
        "en": "Copy option",
        "zh": "复制选项"
      }
    },
    "copied": {
      "locales": {
        "en": "Copied to clipboard",
        "zh": "已复制到剪贴板"
      }
    },
    "copyFailed": {
      "locales": {
        "en": "Copy failed",
        "zh": "复制失败"
      }
    },
    "customInputPlaceholder": {
      "locales": {
        "en": "Or type your own answer...",
        "zh": "或输入自定义回答..."
      }
    }
  },
  "attachments": {
    "source": {
      "locales": {
        "en": "Source",
        "zh": "来源"
      }
    },
    "image": {
      "locales": {
        "en": "Image",
        "zh": "图片"
      }
    },
    "attachment": {
      "locales": {
        "en": "Attachment",
        "zh": "附件"
      }
    },
    "remove": {
      "locales": {
        "en": "Remove",
        "zh": "移除"
      }
    },
    "noAttachments": {
      "locales": {
        "en": "No attachments",
        "zh": "无附件"
      }
    }
  },
  "carousel": {
    "previousSlide": {
      "locales": {
        "en": "Previous slide",
        "zh": "上一张"
      }
    },
    "nextSlide": {
      "locales": {
        "en": "Next slide",
        "zh": "下一张"
      }
    }
  },
  "chat-stream-status-panel": {
    "offlineTitle": {
      "locales": {
        "en": "Network connection lost",
        "zh": "网络连接已断开"
      }
    },
    "offlineDescription": {
      "locales": {
        "en": "The system will keep trying after this device is back online. Replies already shown will not be lost. Please do not refresh the page",
        "zh": "设备恢复联网后，系统会自动继续尝试。当前已经显示的回复不会丢失，请不要刷新页面"
      }
    },
    "offlineBadge": {
      "locales": {
        "en": "Waiting for network",
        "zh": "等待联网"
      }
    },
    "reconnectingTitle": {
      "locales": {
        "en": "The AI reply has paused. Reconnecting automatically…",
        "zh": "AI 回复暂时没有继续，正在自动恢复…"
      }
    },
    "reconnectingDescription": {
      "locales": {
        "en": "No new reply content has arrived for a while, so the system is reconnecting automatically. Content already shown will not be lost. Please do not refresh the page",
        "zh": "系统暂时没有收到新的回复内容，正在自动重新连接。已显示内容不会丢失，请不要刷新页面"
      }
    },
    "reconnectingBufferedTitle": {
      "locales": {
        "en": "The AI reply is not displaying normally. Recovering automatically…",
        "zh": "AI 回复显示异常，正在自动恢复…"
      }
    },
    "reconnectingBufferedDescription": {
      "locales": {
        "en": "The reply may not be appearing promptly and could show all at once after a pause. The system is retrying the current connection",
        "zh": "系统检测到回复内容可能没有及时显示，可能会在等待一段时间后一次性出现。系统正在重试当前连接"
      }
    },
    "reconnectingUnavailableTitle": {
      "locales": {
        "en": "This network cannot receive AI replies reliably. Retrying…",
        "zh": "当前网络无法稳定接收 AI 回复，正在重试…"
      }
    },
    "reconnectingUnavailableDescription": {
      "locales": {
        "en": "New reply content has repeatedly failed to arrive in time. Check your network, proxy, or security software. The system will continue trying automatically",
        "zh": "系统多次没有及时收到新的回复内容。请检查网络、代理或安全软件设置，系统仍会继续自动尝试"
      }
    },
    "recoveringBadge": {
      "locales": {
        "en": "Recovering",
        "zh": "自动恢复中"
      }
    },
    "rebuildingTitle": {
      "locales": {
        "en": "Connection restored. Synchronizing the reply…",
        "zh": "连接已恢复，正在同步回复内容…"
      }
    },
    "rebuildingDescription": {
      "locales": {
        "en": "The system is restoring reply content that was not shown. Content already displayed may adjust briefly. Please wait",
        "zh": "系统正在补回刚才未显示的回复内容，已显示的内容可能会短暂调整，请稍候"
      }
    },
    "rebuildingBufferedDescription": {
      "locales": {
        "en": "The system is restoring the reply, but this network may still delay its display. You can check the connection again after synchronization finishes",
        "zh": "系统正在补回回复内容，但当前网络仍可能导致内容延迟显示。同步完成后可以重新检测网络"
      }
    },
    "syncingBadge": {
      "locales": {
        "en": "Synchronizing",
        "zh": "同步中"
      }
    },
    "checkingTitle": {
      "locales": {
        "en": "Checking the AI reply connection…",
        "zh": "正在检查 AI 回复连接…"
      }
    },
    "checkingDescription": {
      "locales": {
        "en": "The system is testing whether AI replies can display continuously. This does not send your conversation content and usually takes about 3 seconds",
        "zh": "系统正在测试 AI 回复能否持续显示。检测不会发送你的对话内容，通常约 3 秒完成"
      }
    },
    "checkingBadge": {
      "locales": {
        "en": "Checking",
        "zh": "检测中"
      }
    },
    "suspectedTitle": {
      "locales": {
        "en": "The AI reply may be delayed",
        "zh": "AI 回复显示可能有延迟"
      }
    },
    "suspectedDescription": {
      "locales": {
        "en": "The system noticed an unusual delay in reply delivery and is checking the connection. Content already shown will not be lost",
        "zh": "系统发现回复内容到达速度异常，正在检查连接质量。当前已经显示的内容不会丢失"
      }
    },
    "suspectedBadge": {
      "locales": {
        "en": "Checking",
        "zh": "检查中"
      }
    },
    "bufferedTitle": {
      "locales": {
        "en": "The AI reply may appear late",
        "zh": "AI 回复可能会延迟显示"
      }
    },
    "bufferedDescription": {
      "locales": {
        "en": "The reply may pause and then appear all at once. Try another network or turn off your proxy or accelerator, then check again",
        "zh": "系统检测到回复内容可能会停顿一段时间后一次性出现。你可以切换网络、关闭代理或加速器后重新检测"
      }
    },
    "bufferedSwitchDescription": {
      "locales": {
        "en": "This network is buffering SSE replies. Switch to WebSocket to continue receiving the current reply in real time",
        "zh": "当前网络正在缓存 SSE 回复，可切换到 WebSocket 实时续接当前回复"
      }
    },
    "bufferedBadge": {
      "locales": {
        "en": "Display delayed",
        "zh": "显示延迟"
      }
    },
    "switchToWebSocket": {
      "locales": {
        "en": "Switch to WebSocket",
        "zh": "切换到 WebSocket"
      }
    },
    "continueSse": {
      "locales": {
        "en": "Continue with SSE",
        "zh": "继续使用 SSE"
      }
    },
    "unavailableTitle": {
      "locales": {
        "en": "This network cannot receive AI replies reliably",
        "zh": "当前网络无法稳定接收 AI 回复"
      }
    },
    "unavailableDescription": {
      "locales": {
        "en": "Reply content did not arrive in time. Check your network, proxy, or security software, then run the check again",
        "zh": "系统未能及时收到回复内容。请检查网络、代理或安全软件设置，然后重新检测"
      }
    },
    "unavailableBadge": {
      "locales": {
        "en": "Connection issue",
        "zh": "连接异常"
      }
    },
    "inconclusiveTitle": {
      "locales": {
        "en": "The reply connection could not be confirmed",
        "zh": "暂时无法判断回复连接是否正常"
      }
    },
    "inconclusiveDescription": {
      "locales": {
        "en": "The page may have moved to the background during the check, or the device may have briefly gone offline. Keep the page open, confirm the device is online, and check again",
        "zh": "检测时页面可能切到了后台，或者设备曾短暂离线。请保持页面打开并确认设备已联网，然后重新检测"
      }
    },
    "inconclusiveBadge": {
      "locales": {
        "en": "Not confirmed",
        "zh": "无法确认"
      }
    },
    "retry": {
      "locales": {
        "en": "Check again",
        "zh": "重新检测"
      }
    },
    "checking": {
      "locales": {
        "en": "Checking",
        "zh": "检测中"
      }
    }
  },
  "code-preview": {
    "jsonTooLargeTitle": {
      "locales": {
        "zh": "JSON 文件内容过长",
        "en": "JSON file is too large"
      }
    },
    "jsonTooLargeDescription": {
      "locales": {
        "zh": "内容长度超过 100 KB，请下载后查看",
        "en": "The content exceeds 100 KB. Download the file to view it"
      }
    },
    "download": {
      "locales": {
        "zh": "下载文件",
        "en": "Download file"
      }
    }
  },
  "command": {
    "title": {
      "locales": {
        "en": "Command Palette",
        "zh": "命令面板"
      }
    },
    "description": {
      "locales": {
        "en": "Search for a command to run...",
        "zh": "搜索要运行的命令..."
      }
    }
  },
  "conversation": {
    "noMessages": {
      "locales": {
        "en": "No messages yet",
        "zh": "暂无消息"
      }
    },
    "startConversation": {
      "locales": {
        "en": "Start a conversation to see messages here",
        "zh": "开始对话以查看消息"
      }
    }
  },
  "excel-preview": {
    "sheetSwitch": {
      "locales": {
        "zh": "切换工作表",
        "en": "Switch Sheet"
      }
    }
  },
  "file-preview-sheet": {
    "title": {
      "locales": {
        "zh": "文件预览",
        "en": "File Preview"
      }
    },
    "subtitle": {
      "locales": {
        "zh": "查看文件内容",
        "en": "View file content"
      }
    },
    "noFile": {
      "locales": {
        "zh": "未选择文件",
        "en": "No file selected"
      }
    },
    "loadError": {
      "locales": {
        "zh": "文件加载失败",
        "en": "Failed to load file"
      }
    },
    "close": {
      "locales": {
        "zh": "关闭预览",
        "en": "Close preview"
      }
    }
  },
  "inline-citation": {
    "unknown": {
      "locales": {
        "en": "unknown",
        "zh": "未知"
      }
    },
    "previous": {
      "locales": {
        "en": "Previous",
        "zh": "上一个"
      }
    },
    "next": {
      "locales": {
        "en": "Next",
        "zh": "下一个"
      }
    }
  },
  "input-suggestion-menu": {
    "label": {
      "locales": {
        "zh": "操作与能力",
        "en": "Actions and capabilities"
      }
    },
    "selected": {
      "locales": {
        "zh": "已选中",
        "en": "Selected"
      }
    },
    "search": {
      "locales": {
        "zh": "搜索操作、技能、知识库或工具集",
        "en": "Search actions, skills, knowledge or tools"
      }
    },
    "noResults": {
      "locales": {
        "zh": "没有匹配的操作或能力",
        "en": "No matching actions or capabilities"
      }
    },
    "empty": {
      "locales": {
        "zh": "暂无可用操作或能力",
        "en": "No actions or capabilities available"
      }
    }
  },
  "knowledge-citation-badge": {
    "loading": {
      "locales": {
        "en": "Loading citation details...",
        "zh": "正在加载引用详情..."
      }
    },
    "empty": {
      "locales": {
        "en": "No citation details available",
        "zh": "暂无引用详情"
      }
    },
    "openReferences": {
      "locales": {
        "en": "Open references {{numbers}}",
        "zh": "打开引用 {{numbers}}"
      },
      "insert": true
    },
    "typeChunk": {
      "locales": {
        "en": "Document Chunk",
        "zh": "文档块"
      }
    },
    "typeEntity": {
      "locales": {
        "en": "Entity",
        "zh": "实体"
      }
    },
    "typeCommunity": {
      "locales": {
        "en": "Community",
        "zh": "社区"
      }
    },
    "typeClaim": {
      "locales": {
        "en": "Fact",
        "zh": "事实"
      }
    },
    "similarity": {
      "locales": {
        "en": "Similarity",
        "zh": "相似度"
      }
    },
    "sourceVector": {
      "locales": {
        "en": "Vector",
        "zh": "向量"
      }
    },
    "sourceFulltext": {
      "locales": {
        "en": "Full-text",
        "zh": "全文"
      }
    },
    "sourceHybrid": {
      "locales": {
        "en": "Hybrid",
        "zh": "混合"
      }
    },
    "sourceGraph": {
      "locales": {
        "en": "Graph",
        "zh": "图谱"
      }
    },
    "sourceTrajectory": {
      "locales": {
        "en": "Trajectory",
        "zh": "轨迹"
      }
    },
    "sourceDirect": {
      "locales": {
        "en": "Direct reference",
        "zh": "直接引用"
      }
    },
    "fromSubchunk": {
      "locales": {
        "en": "Sub-chunk match",
        "zh": "子块命中"
      }
    },
    "subchunkCount": {
      "locales": {
        "en": "{{count}} sub-chunks matched",
        "zh": "{{count}} 个子块命中"
      },
      "insert": true
    }
  },
  "knowledge-citation-sheet": {
    "title": {
      "locales": {
        "en": "References",
        "zh": "参考引用"
      }
    },
    "description": {
      "locales": {
        "en": "{{count}} references in this answer. {{activeCount}} are used here",
        "zh": "本次回答共 {{count}} 条引用，其中 {{activeCount}} 条用于当前位置"
      },
      "insert": true
    },
    "currentSection": {
      "locales": {
        "en": "Used here",
        "zh": "当前位置引用"
      }
    },
    "otherSection": {
      "locales": {
        "en": "Other references",
        "zh": "其他引用"
      }
    },
    "currentLabel": {
      "locales": {
        "en": "Current",
        "zh": "当前引用"
      }
    },
    "loadingLabel": {
      "locales": {
        "en": "Loading references",
        "zh": "正在加载引用"
      }
    },
    "empty": {
      "locales": {
        "en": "No references available",
        "zh": "暂无引用"
      }
    },
    "detailUnavailable": {
      "locales": {
        "en": "Citation details are unavailable",
        "zh": "引用详情暂不可用"
      }
    },
    "fallbackTitle": {
      "locales": {
        "en": "Reference {{number}}",
        "zh": "引用 {{number}}"
      },
      "insert": true
    },
    "typeChunk": {
      "locales": {
        "en": "Document chunk",
        "zh": "文档片段"
      }
    },
    "typeEntity": {
      "locales": {
        "en": "Entity",
        "zh": "实体"
      }
    },
    "typeCommunity": {
      "locales": {
        "en": "Community",
        "zh": "社区"
      }
    },
    "typeClaim": {
      "locales": {
        "en": "Fact",
        "zh": "事实"
      }
    }
  },
  "loader": {
    "loading": {
      "locales": {
        "en": "Loading",
        "zh": "加载中"
      }
    }
  },
  "message": {
    "previousBranch": {
      "locales": {
        "en": "Previous branch",
        "zh": "上一个分支"
      }
    },
    "nextBranch": {
      "locales": {
        "en": "Next branch",
        "zh": "下一个分支"
      }
    },
    "branchOfTotal": {
      "locales": {
        "en": "{{current}} of {{total}}",
        "zh": "第 {{current}} / {{total}} 个分支"
      },
      "insert": true
    },
    "copy": {
      "locales": {
        "en": "Copy",
        "zh": "复制"
      }
    },
    "copied": {
      "locales": {
        "en": "Copied to clipboard",
        "zh": "已复制到剪贴板"
      }
    },
    "copyFailed": {
      "locales": {
        "en": "Copy failed",
        "zh": "复制失败"
      }
    }
  },
  "message-context-usage-ring": {
    "usageLabel": {
      "locales": {
        "en": "Current message context usage: {{percentage}}",
        "zh": "当前消息上下文占模型上下文窗口的比例：{{percentage}}"
      },
      "insert": true
    },
    "compactDescription": {
      "locales": {
        "en": "This conversation is using {{percentage}} of the model context window. Compressing will summarize earlier context to reduce usage, which may omit some details",
        "zh": "当前对话已使用模型上下文窗口的 {{percentage}}。压缩会将较早的上下文归纳为摘要以降低占用，可能会省略部分细节"
      },
      "insert": true
    },
    "lowUsageDescription": {
      "locales": {
        "en": "This conversation is using {{percentage}} of the model context window. There is still sufficient context available, so compression is not recommended. If you continue, earlier context will be summarized and some details may be omitted",
        "zh": "当前对话已使用模型上下文窗口的 {{percentage}}，上下文余量充足，暂不建议压缩。若仍继续压缩，较早的上下文会被归纳为摘要，可能会省略部分细节"
      },
      "insert": true
    },
    "refreshContext": {
      "locales": {
        "en": "Refresh",
        "zh": "刷新用量"
      }
    },
    "refreshFailed": {
      "locales": {
        "en": "Failed to refresh context usage. Please try again",
        "zh": "刷新上下文用量失败，请稍后重试"
      }
    },
    "compactNow": {
      "locales": {
        "en": "Compress now",
        "zh": "立即压缩上下文"
      }
    },
    "compactSucceeded": {
      "locales": {
        "en": "Context compressed",
        "zh": "上下文已压缩"
      }
    },
    "compactFailed": {
      "locales": {
        "en": "Failed to compress context. Please try again",
        "zh": "压缩上下文失败，请稍后重试"
      }
    }
  },
  "message-navigator": {
    "jumpToMessage": {
      "locales": {
        "en": "Jump to message {{index}}",
        "zh": "跳转到第 {{index}} 条消息"
      },
      "insert": true
    }
  },
  "message-view-switcher": {
    "viewLabel": {
      "locales": {
        "en": "View",
        "zh": "视图"
      }
    },
    "compactView": {
      "locales": {
        "en": "Highlights",
        "zh": "重点"
      }
    },
    "fullView": {
      "locales": {
        "en": "All",
        "zh": "全部"
      }
    },
    "storageError": {
      "locales": {
        "en": "View preference could not be saved",
        "zh": "视图偏好保存失败"
      }
    },
    "storageErrorDescription": {
      "locales": {
        "en": "Your selected view is kept for this session, but may reset when you reload",
        "zh": "当前选择已保留，刷新页面后可能恢复默认视图"
      }
    },
    "compactViewDescription": {
      "locales": {
        "en": "Show important replies, important tools, and tool summaries",
        "zh": "仅显示重要回复、重要工具和工具执行摘要"
      }
    },
    "fullViewDescription": {
      "locales": {
        "en": "Show reasoning, regular replies, and the complete tool execution process",
        "zh": "显示思考消息、普通回复和完整工具执行过程"
      }
    }
  },
  "pagination": {
    "previous": {
      "locales": {
        "en": "Previous",
        "zh": "上一页"
      }
    },
    "next": {
      "locales": {
        "en": "Next",
        "zh": "下一页"
      }
    },
    "goToPreviousPage": {
      "locales": {
        "en": "Go to previous page",
        "zh": "转到上一页"
      }
    },
    "goToNextPage": {
      "locales": {
        "en": "Go to next page",
        "zh": "转到下一页"
      }
    },
    "morePages": {
      "locales": {
        "en": "More pages",
        "zh": "更多页面"
      }
    }
  },
  "plan": {
    "toggle": {
      "locales": {
        "en": "Toggle plan",
        "zh": "切换计划"
      }
    }
  },
  "plan-approval-block": {
    "approve": {
      "locales": {
        "en": "Approve",
        "zh": "批准"
      }
    },
    "approveWithNote": {
      "locales": {
        "en": "Add note and approve",
        "zh": "添加说明并批准"
      }
    },
    "rejectWithNote": {
      "locales": {
        "en": "Reject with note",
        "zh": "拒绝并说明"
      }
    },
    "approved": {
      "locales": {
        "en": "Approved",
        "zh": "已批准"
      }
    },
    "rejected": {
      "locales": {
        "en": "Rejected",
        "zh": "已拒绝"
      }
    },
    "feedbackPlaceholder": {
      "locales": {
        "en": "Enter your feedback...",
        "zh": "请输入反馈说明..."
      }
    },
    "cancel": {
      "locales": {
        "en": "Cancel",
        "zh": "取消"
      }
    },
    "loadingPlan": {
      "locales": {
        "en": "Loading plan...",
        "zh": "加载计划中..."
      }
    },
    "planLoadError": {
      "locales": {
        "en": "Failed to load plan",
        "zh": "计划加载失败"
      }
    },
    "remaining": {
      "locales": {
        "en": "{{duration}} remaining",
        "zh": "剩余 {{duration}}"
      },
      "insert": true
    },
    "timeout": {
      "locales": {
        "en": "Approval timed out",
        "zh": "审批已超时"
      }
    },
    "blocked": {
      "locales": {
        "en": "Plan rejected, waiting for resubmission",
        "zh": "计划已拒绝，等待重新提交"
      }
    },
    "skipped": {
      "locales": {
        "en": "Approval interrupted",
        "zh": "审批已中断"
      }
    },
    "planTitle": {
      "locales": {
        "en": "Execution Plan",
        "zh": "执行计划"
      }
    },
    "noContent": {
      "locales": {
        "en": "No plan content",
        "zh": "暂无计划内容"
      }
    }
  },
  "preview-error": {
    "loadError": {
      "locales": {
        "zh": "文件加载失败",
        "en": "Failed to load file"
      }
    },
    "parseError": {
      "locales": {
        "zh": "文件解析失败",
        "en": "Failed to parse file"
      }
    },
    "invalidDocxArchive": {
      "locales": {
        "zh": "Word 文件内容不完整或不是有效的 DOCX 文件，请重试或重新下载文件",
        "en": "The Word file is incomplete or is not a valid DOCX file. Retry or download it again"
      }
    },
    "invalidPptxArchive": {
      "locales": {
        "zh": "PowerPoint 文件内容不完整或不是有效的 PPTX 文件，请重试或重新下载文件",
        "en": "The PowerPoint file is incomplete or is not a valid PPTX file. Retry or download it again"
      }
    },
    "retry": {
      "locales": {
        "zh": "重试",
        "en": "Retry"
      }
    }
  },
  "preview-loading": {
    "loading": {
      "locales": {
        "zh": "正在加载文件...",
        "en": "Loading file..."
      }
    }
  },
  "preview-toolbar": {
    "zoomIn": {
      "locales": {
        "zh": "放大",
        "en": "Zoom In"
      }
    },
    "zoomOut": {
      "locales": {
        "zh": "缩小",
        "en": "Zoom Out"
      }
    },
    "rotateLeft": {
      "locales": {
        "zh": "向左旋转",
        "en": "Rotate Left"
      }
    },
    "rotateRight": {
      "locales": {
        "zh": "向右旋转",
        "en": "Rotate Right"
      }
    },
    "fullscreen": {
      "locales": {
        "zh": "全屏",
        "en": "Fullscreen"
      }
    },
    "exitFullscreen": {
      "locales": {
        "zh": "退出全屏",
        "en": "Exit Fullscreen"
      }
    },
    "prevPage": {
      "locales": {
        "zh": "上一页",
        "en": "Previous Page"
      }
    },
    "nextPage": {
      "locales": {
        "zh": "下一页",
        "en": "Next Page"
      }
    },
    "pageOf": {
      "locales": {
        "zh": "第 {{current}} 页 / 共 {{total}} 页",
        "en": "Page {{current}} of {{total}}"
      },
      "insert": true
    },
    "download": {
      "locales": {
        "zh": "下载",
        "en": "Download"
      }
    }
  },
  "preview-unsupported": {
    "unsupportedTitle": {
      "locales": {
        "zh": "该格式暂不支持在线预览",
        "en": "This format does not support online preview"
      }
    },
    "unsupportedDescription": {
      "locales": {
        "zh": "不支持 {{fileName}} 文件类型，请下载后查看",
        "en": "{{fileName}} is not supported for online preview, please download"
      },
      "insert": true
    },
    "unsupportedDescriptionGeneric": {
      "locales": {
        "zh": "不支持此文件类型，请下载后查看",
        "en": "This file type is not supported, please download"
      }
    },
    "download": {
      "locales": {
        "zh": "下载",
        "en": "Download"
      }
    }
  },
  "process-group": {
    "search": {
      "locales": {
        "zh": "搜索",
        "en": "Search"
      }
    },
    "read": {
      "locales": {
        "zh": "读取",
        "en": "Read"
      }
    },
    "write": {
      "locales": {
        "zh": "写入",
        "en": "Write"
      }
    },
    "update": {
      "locales": {
        "zh": "修改",
        "en": "Update"
      }
    },
    "delete": {
      "locales": {
        "zh": "删除",
        "en": "Delete"
      }
    },
    "execute": {
      "locales": {
        "zh": "执行",
        "en": "Execute"
      }
    },
    "interact": {
      "locales": {
        "zh": "交互",
        "en": "Interact"
      }
    },
    "delegate": {
      "locales": {
        "zh": "委派",
        "en": "Delegate"
      }
    },
    "default": {
      "locales": {
        "zh": "调用工具",
        "en": "Call tools"
      }
    },
    "thinking": {
      "locales": {
        "zh": "思考过程",
        "en": "Reasoning"
      }
    },
    "thinkingRunning": {
      "locales": {
        "zh": "正在思考",
        "en": "Thinking"
      }
    },
    "runningSearch": {
      "locales": {
        "zh": "正在搜索",
        "en": "Searching"
      }
    },
    "runningRead": {
      "locales": {
        "zh": "正在读取",
        "en": "Reading"
      }
    },
    "runningWrite": {
      "locales": {
        "zh": "正在写入",
        "en": "Writing"
      }
    },
    "runningUpdate": {
      "locales": {
        "zh": "正在修改",
        "en": "Updating"
      }
    },
    "runningDelete": {
      "locales": {
        "zh": "正在删除",
        "en": "Deleting"
      }
    },
    "runningExecute": {
      "locales": {
        "zh": "正在执行",
        "en": "Executing"
      }
    },
    "runningInteract": {
      "locales": {
        "zh": "等待你的操作",
        "en": "Waiting for your input"
      }
    },
    "runningDelegate": {
      "locales": {
        "zh": "正在协调子智能体",
        "en": "Coordinating subagents"
      }
    },
    "runningDefault": {
      "locales": {
        "zh": "正在调用工具",
        "en": "Calling tools"
      }
    },
    "preparingSearch": {
      "locales": {
        "zh": "准备搜索",
        "en": "Preparing to search"
      }
    },
    "preparingRead": {
      "locales": {
        "zh": "准备读取",
        "en": "Preparing to read"
      }
    },
    "preparingWrite": {
      "locales": {
        "zh": "准备写入",
        "en": "Preparing to write"
      }
    },
    "preparingUpdate": {
      "locales": {
        "zh": "准备修改",
        "en": "Preparing to update"
      }
    },
    "preparingDelete": {
      "locales": {
        "zh": "准备删除",
        "en": "Preparing to delete"
      }
    },
    "preparingExecute": {
      "locales": {
        "zh": "准备执行",
        "en": "Preparing to execute"
      }
    },
    "preparingInteract": {
      "locales": {
        "zh": "准备与你交互",
        "en": "Preparing to interact"
      }
    },
    "preparingDelegate": {
      "locales": {
        "zh": "准备协调子智能体",
        "en": "Preparing to coordinate subagents"
      }
    },
    "preparingDefault": {
      "locales": {
        "zh": "准备调用工具",
        "en": "Preparing to call tools"
      }
    },
    "doneSearch": {
      "locales": {
        "zh": "已搜索",
        "en": "Searched"
      }
    },
    "doneRead": {
      "locales": {
        "zh": "已读取",
        "en": "Read"
      }
    },
    "doneWrite": {
      "locales": {
        "zh": "已写入",
        "en": "Wrote"
      }
    },
    "doneUpdate": {
      "locales": {
        "zh": "已修改",
        "en": "Updated"
      }
    },
    "doneDelete": {
      "locales": {
        "zh": "已删除",
        "en": "Deleted"
      }
    },
    "doneExecute": {
      "locales": {
        "zh": "已执行",
        "en": "Executed"
      }
    },
    "doneInteract": {
      "locales": {
        "zh": "已与用户交互",
        "en": "Interacted with the user"
      }
    },
    "doneDelegate": {
      "locales": {
        "zh": "已协调子智能体",
        "en": "Coordinated subagents"
      }
    },
    "doneDefault": {
      "locales": {
        "zh": "已调用工具",
        "en": "Called tools"
      }
    },
    "doneThinking": {
      "locales": {
        "zh": "已完成分析",
        "en": "Analysis completed"
      }
    },
    "doneJoinTwo": {
      "locales": {
        "zh": "{{first}}并{{second}}",
        "en": "{{first}} and {{second}}"
      },
      "insert": true
    },
    "doneSeparator": {
      "locales": {
        "zh": "，",
        "en": ", "
      }
    },
    "doneSharedPrefix": {
      "locales": {
        "zh": "已",
        "en": ""
      }
    },
    "doneMore": {
      "locales": {
        "zh": "{{title}}等",
        "en": "{{title}}, and more"
      },
      "insert": true
    },
    "attention": {
      "locales": {
        "zh": "需要关注 · {{activity}}",
        "en": "Needs attention · {{activity}}"
      },
      "insert": true
    },
    "separator": {
      "locales": {
        "zh": "、",
        "en": ", "
      }
    },
    "more": {
      "locales": {
        "zh": "等",
        "en": " and more"
      }
    },
    "expand": {
      "locales": {
        "zh": "展开过程组",
        "en": "Expand process group"
      }
    },
    "collapse": {
      "locales": {
        "zh": "收起过程组",
        "en": "Collapse process group"
      }
    }
  },
  "prompt-input": {
    "addFiles": {
      "locales": {
        "en": "Add photos or files",
        "zh": "添加图片或文件"
      }
    },
    "uploadFiles": {
      "locales": {
        "en": "Upload files",
        "zh": "上传文件"
      }
    },
    "placeholder": {
      "locales": {
        "en": "What would you like to know?",
        "zh": "想要了解什么？"
      }
    },
    "stop": {
      "locales": {
        "en": "Stop",
        "zh": "停止"
      }
    },
    "submit": {
      "locales": {
        "en": "Submit",
        "zh": "发送"
      }
    },
    "unsupportedFileTypes": {
      "locales": {
        "en": "The following file types are not supported: {{files}}. Please check",
        "zh": "以下文件类型不受支持：{{files}}，请检查"
      },
      "insert": true
    },
    "allFilesExceedSize": {
      "locales": {
        "en": "All files exceed the maximum size",
        "zh": "所有文件超出最大大小限制"
      }
    },
    "tooManyFiles": {
      "locales": {
        "en": "Too many files. Some were not added",
        "zh": "文件过多，部分未添加"
      }
    }
  },
  "reasoning": {
    "thinking": {
      "locales": {
        "en": "Thinking...",
        "zh": "思考中..."
      }
    },
    "thoughtForSeconds": {
      "locales": {
        "en": "Thought for {{duration}} seconds",
        "zh": "思考了 {{duration}} 秒"
      },
      "insert": true
    },
    "thoughtForFewSeconds": {
      "locales": {
        "en": "Thought for a few seconds",
        "zh": "思考了片刻"
      }
    }
  },
  "spinner": {
    "loading": {
      "locales": {
        "en": "Loading",
        "zh": "加载中"
      }
    }
  },
  "sql-chart-result": {
    "title": {
      "locales": {
        "en": "SQL chart",
        "zh": "SQL 图表"
      }
    },
    "summary": {
      "locales": {
        "en": "{{rows}} rows · {{columns}} columns",
        "zh": "{{rows}} 行 · {{columns}} 列"
      },
      "insert": true
    },
    "chartTab": {
      "locales": {
        "en": "Chart",
        "zh": "图表"
      }
    },
    "tableTab": {
      "locales": {
        "en": "Data table",
        "zh": "数据表"
      }
    },
    "exportImage": {
      "locales": {
        "en": "Export image",
        "zh": "导出图片"
      }
    },
    "exportCsv": {
      "locales": {
        "en": "Export CSV",
        "zh": "导出 CSV"
      }
    },
    "exportExcel": {
      "locales": {
        "en": "Export Excel",
        "zh": "导出 Excel"
      }
    },
    "imageExportSuccess": {
      "locales": {
        "en": "Chart image exported",
        "zh": "图表图片导出成功"
      }
    },
    "imageExportError": {
      "locales": {
        "en": "Failed to export chart image",
        "zh": "图表图片导出失败"
      }
    },
    "dataExportSuccess": {
      "locales": {
        "en": "File exported",
        "zh": "文件导出成功"
      }
    },
    "empty": {
      "locales": {
        "en": "The query returned no rows",
        "zh": "没有符合条件的数据"
      }
    },
    "unavailable": {
      "locales": {
        "en": "The conversation information is unavailable, so this chart cannot be loaded",
        "zh": "缺少会话信息，无法加载该图表结果"
      }
    },
    "unsupportedVersion": {
      "locales": {
        "en": "This chart version is not supported. The original data table is shown instead",
        "zh": "暂不支持该图表版本，已改为显示原始数据表"
      }
    },
    "invalidSpec": {
      "locales": {
        "en": "The chart configuration is invalid. The original data table is shown instead",
        "zh": "图表配置无效，已改为显示原始数据表"
      }
    }
  },
  "sql-query-chart-view": {
    "waiting": {
      "locales": {
        "en": "The chart will load when it enters the viewport",
        "zh": "图表进入可视区域后加载"
      }
    },
    "loading": {
      "locales": {
        "en": "Loading chart data...",
        "zh": "正在加载图表数据..."
      }
    },
    "loadError": {
      "locales": {
        "en": "Failed to load chart data",
        "zh": "图表数据加载失败"
      }
    },
    "invalidData": {
      "locales": {
        "en": "The chart data is inconsistent or unsafe to draw. View the original table instead",
        "zh": "图表数据不一致或不适合安全绘制，请查看原始数据表"
      }
    },
    "renderError": {
      "locales": {
        "en": "The chart could not be rendered",
        "zh": "图表渲染失败"
      }
    },
    "retry": {
      "locales": {
        "en": "Retry",
        "zh": "重试"
      }
    },
    "showTable": {
      "locales": {
        "en": "View data table",
        "zh": "查看数据表"
      }
    },
    "nullValue": {
      "locales": {
        "en": "NULL",
        "zh": "NULL"
      }
    },
    "zeroFilledSuffix": {
      "locales": {
        "en": " (missing value shown as 0)",
        "zh": "（缺失值按 0 展示）"
      }
    },
    "ariaLabel": {
      "locales": {
        "en": "Chart: {{title}}",
        "zh": "图表：{{title}}"
      },
      "insert": true
    }
  },
  "sql-query-data-table": {
    "range": {
      "locales": {
        "en": "{{start}}–{{end}} of {{total}}",
        "zh": "第 {{start}}–{{end}} 行，共 {{total}} 行"
      },
      "insert": true
    },
    "page": {
      "locales": {
        "en": "Page {{current}} of {{total}}",
        "zh": "第 {{current}} / {{total}} 页"
      },
      "insert": true
    },
    "loading": {
      "locales": {
        "en": "Loading query result...",
        "zh": "正在加载查询结果..."
      }
    },
    "loadError": {
      "locales": {
        "en": "Failed to load query result",
        "zh": "查询结果加载失败"
      }
    },
    "retry": {
      "locales": {
        "en": "Retry",
        "zh": "重试"
      }
    },
    "empty": {
      "locales": {
        "en": "The query returned no rows",
        "zh": "查询未返回任何数据"
      }
    },
    "nullValue": {
      "locales": {
        "en": "NULL",
        "zh": "NULL"
      }
    }
  },
  "sql-query-result": {
    "title": {
      "locales": {
        "en": "Query result",
        "zh": "查询结果"
      }
    },
    "summary": {
      "locales": {
        "en": "{{rows}} saved rows · {{columns}} columns",
        "zh": "已保存 {{rows}} 行 · {{columns}} 列"
      },
      "insert": true
    },
    "empty": {
      "locales": {
        "en": "The query returned no rows",
        "zh": "查询未返回任何数据"
      }
    },
    "truncated": {
      "locales": {
        "en": "Query result truncated. Showing the first {{limit}} rows out of {{rowCount}} rows. Ask the AI to export the data file to view the complete result",
        "zh": "查询结果已截断，仅显示前 {{limit}} 行，共 {{rowCount}} 行。如果想获取全部数据，可以让大模型导出数据文件查看"
      },
      "insert": true
    },
    "unavailable": {
      "locales": {
        "en": "The conversation information is unavailable, so this result cannot be loaded",
        "zh": "缺少会话信息，无法加载该查询结果"
      }
    }
  },
  "sub-agent-block": {
    "subAgentCall": {
      "locales": {
        "en": "Sub-agent call",
        "zh": "子智能体调用"
      }
    },
    "loading": {
      "locales": {
        "en": "Loading...",
        "zh": "加载中..."
      }
    }
  },
  "subagent-conversation": {
    "waiting": {
      "locales": {
        "zh": "等待子智能体开始执行",
        "en": "Waiting for the subagent to start"
      }
    },
    "noConversation": {
      "locales": {
        "zh": "该子任务未产生对话记录",
        "en": "This task has no conversation history"
      }
    },
    "loadError": {
      "locales": {
        "zh": "子对话加载失败",
        "en": "Unable to load conversation"
      }
    },
    "retry": {
      "locales": {
        "zh": "重试",
        "en": "Retry"
      }
    }
  },
  "subagent-task-status": {
    "statuses": {
      "SUBMITTING": {
        "locales": {
          "zh": "提交中",
          "en": "Submitting"
        }
      },
      "PENDING": {
        "locales": {
          "zh": "等待执行",
          "en": "Pending"
        }
      },
      "RUNNING": {
        "locales": {
          "zh": "执行中",
          "en": "Running"
        }
      },
      "COMPLETED": {
        "locales": {
          "zh": "已完成",
          "en": "Completed"
        }
      },
      "FAILED": {
        "locales": {
          "zh": "执行失败",
          "en": "Failed"
        }
      },
      "CANCELLED": {
        "locales": {
          "zh": "已取消",
          "en": "Cancelled"
        }
      }
    },
    "cancelling": {
      "locales": {
        "zh": "正在取消",
        "en": "Cancelling"
      }
    },
    "waitingCapacity": {
      "locales": {
        "zh": "等待执行名额",
        "en": "Waiting for capacity"
      }
    }
  },
  "task-progress-panel": {
    "title": {
      "locales": {
        "en": "Task Progress",
        "zh": "任务进度"
      }
    },
    "completedCount": {
      "locales": {
        "en": "{{count}} / {{total}} completed",
        "zh": "已完成 {{count}} / {{total}}"
      },
      "insert": true
    },
    "pendingLabel": {
      "locales": {
        "en": "Pending",
        "zh": "待处理"
      }
    },
    "inProgressLabel": {
      "locales": {
        "en": "In progress",
        "zh": "进行中"
      }
    },
    "completedLabel": {
      "locales": {
        "en": "Completed",
        "zh": "已完成"
      }
    }
  },
  "text-to-image-preview": {
    "loading": {
      "locales": {
        "en": "Loading...",
        "zh": "加载中..."
      }
    },
    "fullscreenImage": {
      "locales": {
        "en": "Fullscreen",
        "zh": "全屏查看"
      }
    },
    "downloadImage": {
      "locales": {
        "en": "Download",
        "zh": "下载图片"
      }
    },
    "imageLoadError": {
      "locales": {
        "en": "Image failed to load",
        "zh": "图片加载失败"
      }
    }
  },
  "token-usage-details": {
    "totalTokens": {
      "locales": {
        "en": "Total tokens",
        "zh": "总 Token"
      }
    },
    "inputTokens": {
      "locales": {
        "en": "Input tokens",
        "zh": "输入 Token"
      }
    },
    "outputTokens": {
      "locales": {
        "en": "Output tokens",
        "zh": "输出 Token"
      }
    },
    "uncachedInputTokens": {
      "locales": {
        "en": "Uncached input",
        "zh": "普通输入"
      }
    },
    "cachedInputTokens": {
      "locales": {
        "en": "Cached input",
        "zh": "缓存输入"
      }
    },
    "cacheCreationInputTokens": {
      "locales": {
        "en": "Cache creation input",
        "zh": "缓存创建输入"
      }
    },
    "reasoningTokens": {
      "locales": {
        "en": "Reasoning tokens",
        "zh": "推理 Token"
      }
    },
    "cacheHitRate": {
      "locales": {
        "en": "Cache hit rate",
        "zh": "缓存命中率"
      }
    },
    "unavailable": {
      "locales": {
        "en": "-",
        "zh": "-"
      }
    },
    "compactAriaLabel": {
      "locales": {
        "en": "View token usage details",
        "zh": "查看 Token 用量详情"
      }
    }
  },
  "tool": {
    "pending": {
      "locales": {
        "en": "Pending",
        "zh": "待处理"
      }
    },
    "running": {
      "locales": {
        "en": "Running",
        "zh": "运行中"
      }
    },
    "awaitingApproval": {
      "locales": {
        "en": "Awaiting Approval",
        "zh": "等待审批"
      }
    },
    "approvalResponded": {
      "locales": {
        "en": "Approval Responded",
        "zh": "审批已响应"
      }
    },
    "success": {
      "locales": {
        "en": "Success",
        "zh": "成功"
      }
    },
    "noResult": {
      "locales": {
        "en": "No Result",
        "zh": "无结果"
      }
    },
    "error": {
      "locales": {
        "en": "Error",
        "zh": "错误"
      }
    },
    "timeout": {
      "locales": {
        "en": "Timed Out",
        "zh": "执行超时"
      }
    },
    "approvalDenied": {
      "locales": {
        "en": "Approval Denied",
        "zh": "审批拒绝"
      }
    },
    "blocked": {
      "locales": {
        "en": "Blocked",
        "zh": "已阻止"
      }
    },
    "skipped": {
      "locales": {
        "en": "Skipped",
        "zh": "已跳过"
      }
    },
    "interrupted": {
      "locales": {
        "en": "Interrupted",
        "zh": "已中断"
      }
    },
    "parameters": {
      "locales": {
        "en": "Parameters",
        "zh": "参数"
      }
    },
    "result": {
      "locales": {
        "en": "Result",
        "zh": "结果"
      }
    }
  },
  "tool-awaiting-input": {
    "checkingStatus": {
      "locales": {
        "en": "Checking whether this question is still active...",
        "zh": "正在确认问题状态…"
      }
    },
    "interrupted": {
      "locales": {
        "en": "Interrupted",
        "zh": "已中断"
      }
    },
    "recommended": {
      "locales": {
        "en": "Recommended",
        "zh": "推荐"
      }
    },
    "unavailable": {
      "locales": {
        "en": "This question is no longer available. Refresh the message to see its latest state",
        "zh": "该问题已无法继续回答，请刷新本轮消息查看最新状态"
      }
    },
    "statusFailed": {
      "locales": {
        "en": "The question status could not be confirmed. Submitting remains disabled",
        "zh": "无法确认问题状态，提交已保持禁用"
      }
    },
    "retryStatus": {
      "locales": {
        "en": "Check again",
        "zh": "重新确认状态"
      }
    },
    "submitFailed": {
      "locales": {
        "en": "The answer could not be submitted",
        "zh": "回答提交失败"
      }
    }
  },
  "tool-code-extension": {
    "mathFormulaTitle": {
      "locales": {
        "en": "Math formula",
        "zh": "数学公式"
      }
    },
    "mathResultTitle": {
      "locales": {
        "en": "Math result",
        "zh": "计算结果"
      }
    },
    "jsScriptTitle": {
      "locales": {
        "en": "JavaScript script",
        "zh": "JavaScript 脚本"
      }
    },
    "jsStdoutTitle": {
      "locales": {
        "en": "Console output",
        "zh": "控制台输出"
      }
    },
    "jsResultTitle": {
      "locales": {
        "en": "JavaScript result",
        "zh": "执行结果"
      }
    },
    "copyMathFormula": {
      "locales": {
        "en": "Copy math formula",
        "zh": "复制数学公式"
      }
    },
    "copyMathResult": {
      "locales": {
        "en": "Copy math result",
        "zh": "复制计算结果"
      }
    },
    "copyJsScript": {
      "locales": {
        "en": "Copy JavaScript script",
        "zh": "复制 JavaScript 脚本"
      }
    },
    "copyJsStdout": {
      "locales": {
        "en": "Copy console output",
        "zh": "复制控制台输出"
      }
    },
    "copyJsResult": {
      "locales": {
        "en": "Copy JavaScript result",
        "zh": "复制 JavaScript 执行结果"
      }
    },
    "variables": {
      "locales": {
        "en": "Variables",
        "zh": "变量赋值"
      }
    },
    "noReturnValue": {
      "locales": {
        "en": "No return value",
        "zh": "无返回值"
      }
    }
  },
  "tool-events-block": {
    "fallbackTitle": {
      "locales": {
        "en": "{{action}} {{toolName}}",
        "zh": "{{action}} {{toolName}}"
      },
      "insert": true
    },
    "actionDefault": {
      "locales": {
        "en": "Tool call",
        "zh": "工具调用"
      }
    },
    "actionSearch": {
      "locales": {
        "en": "Search",
        "zh": "搜索"
      }
    },
    "actionRead": {
      "locales": {
        "en": "Read",
        "zh": "读取"
      }
    },
    "actionWrite": {
      "locales": {
        "en": "Write",
        "zh": "写入"
      }
    },
    "actionUpdate": {
      "locales": {
        "en": "Update",
        "zh": "更新"
      }
    },
    "actionDelete": {
      "locales": {
        "en": "Delete",
        "zh": "删除"
      }
    },
    "actionExecute": {
      "locales": {
        "en": "Execute",
        "zh": "执行"
      }
    },
    "actionInteract": {
      "locales": {
        "en": "Interaction",
        "zh": "交互"
      }
    },
    "actionDelegate": {
      "locales": {
        "en": "Delegate",
        "zh": "委托"
      }
    },
    "pending": {
      "locales": {
        "en": "Pending",
        "zh": "等待执行"
      }
    },
    "running": {
      "locales": {
        "en": "Running",
        "zh": "执行中"
      }
    },
    "awaitingApproval": {
      "locales": {
        "en": "Awaiting approval",
        "zh": "等待审批"
      }
    },
    "approvalResponded": {
      "locales": {
        "en": "Approval responded",
        "zh": "已响应审批"
      }
    },
    "success": {
      "locales": {
        "en": "Completed",
        "zh": "已完成"
      }
    },
    "noResult": {
      "locales": {
        "en": "No result",
        "zh": "无结果"
      }
    },
    "error": {
      "locales": {
        "en": "Failed",
        "zh": "执行失败"
      }
    },
    "timeout": {
      "locales": {
        "en": "Timed out",
        "zh": "执行超时"
      }
    },
    "approvalDenied": {
      "locales": {
        "en": "Approval denied",
        "zh": "审批已拒绝"
      }
    },
    "blocked": {
      "locales": {
        "en": "Blocked",
        "zh": "已阻止"
      }
    },
    "skipped": {
      "locales": {
        "en": "Skipped",
        "zh": "已跳过"
      }
    },
    "interrupted": {
      "locales": {
        "en": "Interrupted",
        "zh": "已中断"
      }
    },
    "defaultError": {
      "locales": {
        "en": "The tool failed without additional error details",
        "zh": "工具执行失败，未提供更多错误详情"
      }
    },
    "defaultTimeout": {
      "locales": {
        "en": "The tool execution timed out",
        "zh": "工具执行超时"
      }
    },
    "defaultBlocked": {
      "locales": {
        "en": "The tool execution was blocked",
        "zh": "工具执行已被阻止"
      }
    },
    "defaultApprovalDenied": {
      "locales": {
        "en": "The tool execution was not approved",
        "zh": "工具执行未获批准"
      }
    },
    "defaultInterrupted": {
      "locales": {
        "en": "The tool execution was interrupted",
        "zh": "工具执行已中断"
      }
    },
    "historicalAnswer": {
      "locales": {
        "en": "Recorded answer",
        "zh": "历史回答"
      }
    },
    "selectedOptions": {
      "locales": {
        "en": "Selected options",
        "zh": "已选择"
      }
    },
    "noSelectedOptions": {
      "locales": {
        "en": "No option selected",
        "zh": "未选择选项"
      }
    },
    "customAnswer": {
      "locales": {
        "en": "Additional answer",
        "zh": "补充回答"
      }
    },
    "unsupportedPreview": {
      "locales": {
        "en": "A dedicated preview is not supported for this tool result",
        "zh": "此工具结果暂不支持专用预览"
      }
    }
  },
  "turn-execution-stats": {
    "roundSteps": {
      "locales": {
        "zh": "{{rounds}}次{{steps}}步",
        "en": "{{rounds}} calls, {{steps}} steps"
      },
      "insert": true
    },
    "cacheHit": {
      "locales": {
        "zh": "缓存命中{{rate}}",
        "en": "Cache hit {{rate}}"
      },
      "insert": true
    }
  },
  "use-agent-goal": {
    "submitting": {
      "locales": {
        "zh": "目标操作正在提交",
        "en": "A goal operation is being submitted"
      }
    },
    "unavailable": {
      "locales": {
        "zh": "目标操作不可用",
        "en": "Goal operations are unavailable"
      }
    },
    "switched": {
      "locales": {
        "zh": "会话已切换，请重新设置目标",
        "en": "Conversation changed; set the goal again"
      }
    },
    "notReady": {
      "locales": {
        "zh": "目标状态尚未就绪",
        "en": "Goal state is not ready"
      }
    },
    "missing": {
      "locales": {
        "zh": "会话不存在",
        "en": "Conversation is unavailable"
      }
    }
  },
  "use-chat": {
    "initConversationError": {
      "locales": {
        "en": "Failed to initialize conversation history",
        "zh": "初始化对话历史记录发生异常！"
      }
    },
    "waitForResponse": {
      "locales": {
        "en": "Please wait for the previous response to complete",
        "zh": "请等待上条信息响应完成"
      }
    }
  },
  "use-check-prompt-variables": {
    "requiredField": {
      "locales": {
        "en": "{{field}} is required",
        "zh": "{{field}}必填"
      },
      "insert": true
    }
  },
  "user-message-attachment-list": {
    "expandAll": {
      "locales": {
        "en": "Show all ({{count}})",
        "zh": "展开全部（{{count}}）"
      },
      "insert": true
    },
    "collapse": {
      "locales": {
        "en": "Collapse",
        "zh": "收起"
      }
    }
  },
  "user-message-attachments": {
    "loading": {
      "locales": {
        "en": "Loading...",
        "zh": "加载中..."
      }
    },
    "imageLoadError": {
      "locales": {
        "en": "Failed to load image",
        "zh": "图片加载失败"
      }
    },
    "downloadImage": {
      "locales": {
        "en": "Download image",
        "zh": "下载图片"
      }
    },
    "imagePreviewTitle": {
      "locales": {
        "en": "Image Preview",
        "zh": "图片预览"
      }
    }
  },
  "web-preview": {
    "enterUrl": {
      "locales": {
        "en": "Enter URL...",
        "zh": "输入 URL..."
      }
    },
    "preview": {
      "locales": {
        "en": "Preview",
        "zh": "预览"
      }
    },
    "console": {
      "locales": {
        "en": "Console",
        "zh": "控制台"
      }
    },
    "warningCount": {
      "locales": {
        "en": "Warnings",
        "zh": "警告"
      }
    },
    "errorCount": {
      "locales": {
        "en": "Errors",
        "zh": "错误"
      }
    },
    "aiFixConsoleErrors": {
      "locales": {
        "en": "Fix console errors with AI",
        "zh": "使用 AI 修复控制台错误"
      }
    },
    "noConsoleOutput": {
      "locales": {
        "en": "No console output",
        "zh": "无控制台输出"
      }
    }
  },
  "workspace-artifact-list": {
    "reloadPreview": {
      "locales": {
        "en": "Reload preview",
        "zh": "刷新预览"
      }
    },
    "openInNewTab": {
      "locales": {
        "en": "Open in new tab",
        "zh": "在新标签页打开"
      }
    },
    "goBack": {
      "locales": {
        "en": "Go back",
        "zh": "后退"
      }
    },
    "goForward": {
      "locales": {
        "en": "Go forward",
        "zh": "前进"
      }
    },
    "maximize": {
      "locales": {
        "en": "Maximize",
        "zh": "全屏"
      }
    },
    "restorePreview": {
      "locales": {
        "en": "Exit fullscreen",
        "zh": "退出全屏"
      }
    },
    "previewBridgeConnected": {
      "locales": {
        "en": "Preview bridge connected",
        "zh": "预览桥接已连接"
      }
    },
    "networkRequestFailed": {
      "locales": {
        "en": "Failed",
        "zh": "失败"
      }
    },
    "aiFixPromptInstruction": {
      "locales": {
        "en": "Locate and fix the issues shown in the following HTML preview console logs. Modify the relevant code directly instead of only explaining the cause, then briefly summarize the changes",
        "zh": "请根据以下 HTML 页面预览控制台日志定位并修复问题。请直接修改相关代码，不要只解释原因，并在完成后简要说明改动"
      }
    },
    "aiFixPromptPage": {
      "locales": {
        "en": "Preview page",
        "zh": "预览页面"
      }
    },
    "aiFixPromptLogs": {
      "locales": {
        "en": "Console logs",
        "zh": "控制台日志"
      }
    },
    "errorLogLevel": {
      "locales": {
        "en": "ERROR",
        "zh": "错误"
      }
    },
    "warningLogLevel": {
      "locales": {
        "en": "WARNING",
        "zh": "警告"
      }
    }
  },
  "workspace-content-tabs": {
    "home": {
      "locales": {
        "zh": "开始",
        "en": "Start"
      }
    },
    "tabsLabel": {
      "locales": {
        "zh": "工作区标签页",
        "en": "Workspace tabs"
      }
    },
    "closeTab": {
      "locales": {
        "zh": "关闭 {{title}}",
        "en": "Close {{title}}"
      },
      "insert": true
    },
    "closeWorkspace": {
      "locales": {
        "zh": "收起工作区",
        "en": "Hide workspace"
      }
    },
    "file": {
      "locales": {
        "zh": "文件预览",
        "en": "File preview"
      }
    },
    "taskUnavailable": {
      "locales": {
        "zh": "此子智能体任务已不可用",
        "en": "This subagent task is unavailable"
      }
    },
    "currentVersion": {
      "locales": {
        "zh": "当前版本",
        "en": "Current version"
      }
    },
    "historicalVersion": {
      "locales": {
        "zh": "历史版本",
        "en": "Historical version"
      }
    },
    "noFiles": {
      "locales": {
        "en": "No workspace items yet",
        "zh": "工作区暂无内容"
      }
    },
    "loading": {
      "locales": {
        "en": "Loading...",
        "zh": "加载中..."
      }
    },
    "loadError": {
      "locales": {
        "en": "Failed to load workspace files",
        "zh": "工作区文件加载失败"
      }
    },
    "retry": {
      "locales": {
        "en": "Retry",
        "zh": "重试"
      }
    },
    "fileArtifacts": {
      "locales": {
        "en": "Files",
        "zh": "文件"
      }
    },
    "nonFileArtifacts": {
      "locales": {
        "en": "Other artifacts",
        "zh": "其他制品"
      }
    },
    "htmlPage": {
      "locales": {
        "en": "HTML page",
        "zh": "HTML 页面"
      }
    },
    "refreshFiles": {
      "locales": {
        "zh": "刷新工作区文件",
        "en": "Refresh workspace files"
      }
    },
    "refreshPreview": {
      "locales": {
        "zh": "刷新预览",
        "en": "Refresh preview"
      }
    },
    "download": {
      "locales": {
        "zh": "下载",
        "en": "Download"
      }
    },
    "downloadError": {
      "locales": {
        "zh": "下载失败",
        "en": "Download failed"
      }
    },
    "artifacts": {
      "locales": {
        "zh": "工作区制品",
        "en": "Artifacts"
      }
    },
    "subagents": {
      "locales": {
        "zh": "子智能体列表",
        "en": "Subagents"
      }
    },
    "goalHistory": {
      "locales": {
        "zh": "目标历史",
        "en": "Goal history"
      }
    }
  },
  "workspace-sheet-panel": {
    "title": {
      "locales": {
        "zh": "工作区",
        "en": "Workspace"
      }
    },
    "description": {
      "locales": {
        "zh": "浏览会话制品、子智能体与目标历史",
        "en": "Browse conversation artifacts, subagents and goal history"
      }
    }
  },
  "workspace-start": {
    "artifacts": {
      "locales": {
        "zh": "工作区制品",
        "en": "Workspace artifacts"
      }
    },
    "artifactsDescription": {
      "locales": {
        "zh": "浏览文件与页面，打开制品预览",
        "en": "Browse files and pages, and open artifact previews"
      }
    },
    "subagents": {
      "locales": {
        "zh": "子智能体列表",
        "en": "Subagents"
      }
    },
    "subagentsDescription": {
      "locales": {
        "zh": "查看子智能体的执行进度与结果",
        "en": "View subagent progress and results"
      }
    },
    "goalHistory": {
      "locales": {
        "zh": "目标历史",
        "en": "Goal history"
      }
    },
    "goalHistoryDescription": {
      "locales": {
        "zh": "查看当前会话的目标记录",
        "en": "View goal records for this conversation"
      }
    }
  },
  "workspace-subagent-detail": {
    "cancel": {
      "locales": {
        "zh": "取消任务",
        "en": "Cancel task"
      }
    },
    "cancelRequested": {
      "locales": {
        "zh": "取消请求已提交",
        "en": "Cancellation requested"
      }
    },
    "cancelled": {
      "locales": {
        "zh": "子任务已取消",
        "en": "Subagent cancelled"
      }
    },
    "cancelError": {
      "locales": {
        "zh": "取消子任务失败",
        "en": "Unable to cancel subagent"
      }
    },
    "denied": {
      "locales": {
        "zh": "当前会话仅供查看",
        "en": "This conversation is read-only"
      }
    }
  },
  "workspace-subagents": {
    "title": {
      "locales": {
        "zh": "子智能体列表",
        "en": "Subagents"
      }
    },
    "loading": {
      "locales": {
        "zh": "正在加载子任务",
        "en": "Loading subagents"
      }
    },
    "empty": {
      "locales": {
        "zh": "当前会话暂无子任务",
        "en": "No subagents in this conversation"
      }
    },
    "loadError": {
      "locales": {
        "zh": "子任务状态同步失败",
        "en": "Unable to synchronize subagents"
      }
    },
    "retry": {
      "locales": {
        "zh": "重试",
        "en": "Retry"
      }
    },
    "general": {
      "locales": {
        "zh": "通用子智能体",
        "en": "General purpose"
      }
    },
    "fork": {
      "locales": {
        "zh": "上下文延续",
        "en": "Forked context"
      }
    },
    "open": {
      "locales": {
        "zh": "查看子对话",
        "en": "View conversation"
      }
    },
    "refresh": {
      "locales": {
        "zh": "刷新子任务",
        "en": "Refresh subagents"
      }
    }
  }
} as const;
