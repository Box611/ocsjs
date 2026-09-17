import { AnswerWrapperHandlerConfig, defaultAnswerWrapperHandler, request, $ } from '@ocsjs/core';
import type { AnswererWrapper, SearchInformation } from '@ocsjs/core';
import { CommonProject } from '../projects/common';
import { createAIHeaders, DEFAULT_AI_PROVIDER_ID, getAIProvider, resolveAIEndpoint } from './ai-providers';
import type { AIProvider } from './ai-providers';

/**
 * AI 大模型答题配置
 *
 * 配置来源 : 通用 - 全局设置 - AI 大模型自动答题
 */
export interface AIAnswerConfig {
	enabled: boolean;
	/** 供应商标识 */
	providerId: string;
	/** 供应商预设 */
	provider: AIProvider;
	/** 用户填写的接口地址（可能为空，此时使用供应商预设地址） */
	url: string;
	/** 最终解析出的 chat/completions 请求地址 */
	endpoint: string;
	apiKey: string;
	model: string;
	prompt: string;
}

/**
 * 读取全局设置中的 AI 大模型配置
 *
 * 兼容旧版本只配置了 aiAnswerUrl 而没有配置供应商的情况：
 * 会自动根据历史接口地址推断供应商。
 */
export function getAIAnswerConfig(): AIAnswerConfig {
	const cfg = CommonProject.scripts.settings.cfg;
	const url = String(cfg.aiAnswerUrl || '').trim();
	let providerId = String(cfg.aiAnswerProvider || '').trim();

	// 旧配置迁移：没有供应商时根据历史接口地址推断
	if (!providerId) {
		providerId = guessProviderId(url);
	}

	const provider = getAIProvider(providerId);

	return {
		enabled: cfg.aiAnswer === true,
		providerId: provider.id,
		provider,
		url,
		endpoint: resolveAIEndpoint(provider, url),
		apiKey: String(cfg.aiAnswerKey || '').trim(),
		model: String(cfg.aiAnswerModel || '').trim() || provider.models[0] || '',
		prompt: String(cfg.aiAnswerPrompt || '').trim()
	};
}

/** 根据历史接口地址推断供应商标识（用于旧配置兼容） */
function guessProviderId(url: string): string {
	if (!url) {
		return DEFAULT_AI_PROVIDER_ID;
	}
	const rules: [RegExp, string][] = [
		[/deepseek\.com/i, 'deepseek'],
		[/lkeap|tencent/i, 'tencent-token-plan'],
		[/moonshot\.cn/i, 'moonshot'],
		[/dashscope\.aliyuncs\.com/i, 'qwen'],
		[/bigmodel\.cn/i, 'zhipu'],
		[/siliconflow\.cn/i, 'siliconflow'],
		[/api\.openai\.com/i, 'openai'],
		[/localhost:11434|127\.0\.0\.1:11434/i, 'ollama']
	];
	for (const [pattern, id] of rules) {
		if (pattern.test(url)) {
			return id;
		}
	}
	return 'custom';
}

/** 是否开启了 AI 大模型自动答题 */
export function isAIAnswerEnabled() {
	return getAIAnswerConfig().enabled;
}

/** 题型名称映射 */
const AI_TYPE_NAMES: Record<string, string> = {
	single: '单选题',
	multiple: '多选题',
	judgement: '判断题',
	completion: '填空题'
};

/** 系统提示词 */
const AI_SYSTEM_PROMPT = [
	'你是一个专业的考试答题助手，请严格按以下规则作答，只输出答案本身，不要任何解释。',
	'1. 单选题：只输出一个选项字母，例如 A；',
	'2. 多选题：只输出选项字母，例如 ABD，字母之间不要任何分隔符；',
	'3. 判断题：只输出 对 或 错；',
	'4. 填空题：直接输出填空内容，如果题目有多个空，用 # 分隔每个空的答案。'
].join('\n');

/**
 * 向 OpenAI 兼容接口发起 chat/completions 请求
 *
 * 优先使用 GM_xmlhttpRequest（用户脚本环境），失败后降级 fetch 重试。
 *
 * @param opts 请求参数
 * @returns 接口返回的原始 JSON 数据
 */
export async function requestAIChat(opts: {
	endpoint: string;
	provider: AIProvider;
	apiKey: string;
	model: string;
	/** 是否要求模型返回 JSON 对象 */
	messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
	/** 超时时间（毫秒），默认使用答题器的超时时间 */
	timeout?: number;
	temperature?: number;
	/** 要求返回 json 对象（部分供应商不支持，默认关闭） */
	silent?: boolean;
}): Promise<any> {
	const { endpoint, provider, apiKey, model, messages } = opts;
	if (!endpoint) {
		throw new Error('未配置 AI 接口地址，请前往 通用-全局设置 中的 AI 大模型自动答题进行配置。');
	}
	if (!model) {
		throw new Error('未配置 AI 模型，请前往 通用-全局设置 中的 AI 大模型自动答题进行配置。');
	}

	const headers = createAIHeaders(provider, apiKey);

	const data = {
		model,
		messages,
		temperature: opts.temperature ?? 0,
		stream: false
	};

	const timeout = opts.timeout ?? AnswerWrapperHandlerConfig.timeout_seconds * 1000;

	let response: any;
	// eslint-disable-next-line no-undef
	if (typeof GM_xmlhttpRequest !== 'undefined') {
		try {
			response = await Promise.race([
				request(endpoint, {
					type: 'GM_xmlhttpRequest',
					method: 'post',
					responseType: 'json',
					headers,
					data
				}),
				$.sleep(timeout)
			]);
		} catch (e) {
			if (!opts.silent) {
				console.warn('[ocsjs] AI 接口 GM_xmlhttpRequest 请求失败，尝试使用 fetch 重试 : ', e);
			}
		}
	}
	if (response === undefined) {
		try {
			response = await Promise.race([
				request(endpoint, {
					type: 'fetch',
					method: 'post',
					responseType: 'json',
					headers,
					data
				}),
				$.sleep(timeout)
			]);
		} catch (e) {
			if (!opts.silent) {
				console.warn('[ocsjs] AI 接口 fetch 请求失败 : ', e);
			}
		}
	}
	if (response === undefined) {
		throw new Error('AI 接口请求超时，请检查接口地址与网络后重试。');
	}

	// 接口返回错误
	if (response?.error?.message) {
		throw new Error('AI 接口返回错误：' + response.error.message);
	}
	// 部分供应商会把错误放在 code / message 中
	if (response?.code && response?.message && response?.choices === undefined) {
		throw new Error(`AI 接口返回错误（${response.code}）：${response.message}`);
	}

	return response;
}

/**
 * 测试 AI 模型连接
 *
 * 发送一条极短的请求，用于校验 API Key、模型名称和接口地址是否正确。
 * 不会抛出异常，而是返回统一的结果对象，方便 UI 直接展示。
 */
export async function testAIConnection(opts: {
	providerId: string;
	url: string;
	apiKey: string;
	model: string;
}): Promise<{ success: boolean; message: string; latency?: number }> {
	const provider = getAIProvider(opts.providerId);
	const endpoint = resolveAIEndpoint(provider, opts.url);
	const start = Date.now();

	try {
		const response = await requestAIChat({
			endpoint,
			provider,
			apiKey: opts.apiKey,
			model: opts.model,
			messages: [
				{ role: 'system', content: '你是一个测试助手，只需要回复 ok。' },
				{ role: 'user', content: '请回复 ok' }
			],
			timeout: 20000,
			silent: true
		});

		const content = extractAIContent(response);
		if (!content) {
			// 有返回但内容为空，说明接口通了，可能是模型不支持该参数
			const usage = response?.usage;
			if (usage) {
				return { success: true, message: '连接成功（模型已响应）', latency: Date.now() - start };
			}
			return { success: false, message: '连接成功但返回内容为空，请检查模型名称是否正确。' };
		}
		return { success: true, message: `连接成功，模型回复：${content.slice(0, 20)}`, latency: Date.now() - start };
	} catch (e: any) {
		const message = String(e?.message || e);
		if (/401|Unauthorized|invalid.*key|api.?key/i.test(message)) {
			return { success: false, message: '连接失败：API Key 无效或未授权（401）。' };
		}
		if (/403|Forbidden/i.test(message)) {
			return { success: false, message: '连接失败：无权限访问该模型（403），请确认模型是否已开通。' };
		}
		if (/404|model.*not.*found/i.test(message)) {
			return { success: false, message: '连接失败：接口地址或模型名称不存在（404），请检查。' };
		}
		if (/timeout|超时/i.test(message)) {
			return { success: false, message: '连接失败：请求超时，请检查网络或接口地址。' };
		}
		return { success: false, message: '连接失败：' + message };
	}
}

/**
 * AI 大模型作答
 *
 * 调用 OpenAI 兼容的 chat/completions 接口（DeepSeek / Kimi / 通义千问 / OpenAI 等），
 * 将题目和选项发给大模型，并解析出答案。
 *
 * @param env 题目信息
 * @returns 查题信息，结果会带有 `extra_data.ai = true` 标记
 */
export async function aiAnswer(env: {
	title: string;
	type: string;
	options?: string;
	blankCount?: number;
}): Promise<SearchInformation> {
	const cfg = getAIAnswerConfig();
	if (!cfg.endpoint) {
		throw new Error('未配置 AI 接口地址，请前往 通用-全局设置 填写。');
	}
	if (!cfg.model) {
		throw new Error('未配置 AI 模型，请前往 通用-全局设置 填写。');
	}

	const typeName = AI_TYPE_NAMES[env.type] || '问答题';

	// 构造用户消息
	const lines: string[] = [`题型：${typeName}`, `题目：${env.title}`];
	const optionsText = (env.options || '').trim();
	if (env.type !== 'completion' && optionsText) {
		lines.push('选项：');
		lines.push(optionsText);
	}
	if (env.type === 'completion' && env.blankCount && env.blankCount > 1) {
		lines.push(`本题有 ${env.blankCount} 个空，请用 # 分隔每个空的答案。`);
	}
	lines.push('请输出答案：');
	const userMessage = lines.join('\n');

	const response = await requestAIChat({
		endpoint: cfg.endpoint,
		provider: cfg.provider,
		apiKey: cfg.apiKey,
		model: cfg.model,
		messages: [
			{ role: 'system', content: AI_SYSTEM_PROMPT + (cfg.prompt ? `\n${cfg.prompt}` : '') },
			{ role: 'user', content: userMessage }
		]
	});

	const content = extractAIContent(response);
	if (!content) {
		throw new Error('AI 接口返回内容为空。');
	}

	const answer = extractAnswerByType(content, env.type, env.blankCount);

	return {
		name: `AI 大模型（${cfg.provider.name}）`,
		homepage: cfg.endpoint,
		results: [{ question: env.title, answer, extra_data: { ai: true } }]
	};
}

/** 从响应中提取大模型输出文本，兼容多种 OpenAI 风格返回格式 */
function extractAIContent(response: any): string {
	let content =
		response?.choices?.[0]?.message?.content ??
		response?.choices?.[0]?.text ??
		response?.data?.choices?.[0]?.message?.content ??
		response?.output?.text ??
		'';
	// 兼容 content 为分段数组的返回格式（例如 [{ type: 'text', text: 'A' }]）
	if (Array.isArray(content)) {
		content = content.map((part: any) => (typeof part === 'string' ? part : part?.text ?? '')).join('');
	}
	return typeof content === 'string' ? content.trim() : String(content ?? '').trim();
}

/** 根据题型从大模型输出文本中提取答案 */
function extractAnswerByType(content: string, type: string, blankCount?: number): string {
	let text = content
		// 去除代码块包裹
		.replace(/^```[a-zA-Z]*\n?/, '')
		.replace(/```$/, '')
		// 去除常见前缀
		.replace(/^(参考答案|标准答案|正确选项|正确答案|答案|answer)[:：为是\s]*/i, '')
		// 去除尾部标点
		.replace(/[。.，,;；:：!！?？\s]+$/, '')
		.trim();

	if (type === 'single' || type === 'multiple') {
		// 答案本身是纯字母时（例如 B 或者 ABD），直接解析为选项字母
		const pure = text.replace(/[\s、,，.。;；:：()（）【】[\]]/g, '');
		if (/^[A-H]{1,8}$/i.test(pure)) {
			const letters = pure.toUpperCase().split('');
			return type === 'single' ? letters[0] : [...new Set(letters)].join('');
		}
	}
	if (type === 'judgement') {
		if (/(错误|不正确|不对|不是|错|否|非|×|✕|false|^f$|^no$)/i.test(text)) {
			return '错';
		}
		if (/(正确|对|是|√|✓|true|^t$|^yes$)/i.test(text)) {
			return '对';
		}
	}
	if (type === 'completion' && blankCount && blankCount > 1 && !text.includes('#')) {
		// 多个空但没有用 # 分隔时，尝试按换行或常见标点拆分
		const parts = text
			.split(/\n|[,，、;；]/)
			.map((s) => s.trim())
			.filter(Boolean);
		if (parts.length > 1) {
			return parts.slice(0, blankCount).join('#');
		}
	}
	return text;
}

/**
 * 题库搜不到答案时使用 AI 大模型兜底答题
 *
 * - 未开启 AI 自动答题时，直接返回原查题结果
 * - 题库已经搜到答案时，不使用 AI（避免覆盖题库答案）
 * - 题型不在支持范围内（连线题、阅读理解等）时，不使用 AI
 *
 * @param env 题目信息
 * @param searchInfos 题库查题结果
 */
export async function aiAnswerFallback(
	env: { title: string; type: string; options?: string; blankCount?: number },
	searchInfos: SearchInformation[]
): Promise<SearchInformation[]> {
	const cfg = getAIAnswerConfig();
	if (!cfg.enabled) {
		return searchInfos;
	}
	// 仅支持常规题型（unknown 用于在线搜题场景）
	if (['single', 'multiple', 'judgement', 'completion', 'unknown'].includes(env.type) === false) {
		return searchInfos;
	}
	// 题库已经搜到答案
	if (searchInfos.some((info) => info.results.some((res) => res.answer && res.answer.trim() !== ''))) {
		return searchInfos;
	}

	try {
		const info = await aiAnswer(env);
		return [...searchInfos, info];
	} catch (e) {
		return [
			...searchInfos,
			{
				name: `AI 大模型（${cfg.provider.name}）`,
				homepage: cfg.endpoint,
				results: [],
				error: (e as any)?.message || 'AI 接口连接失败'
			}
		];
	}
}

/**
 * 统一搜题入口：先查题库，题库搜不到时使用 AI 大模型兜底
 *
 * 题库配置为空（answererWrappers 为空数组）但开启了 AI 自动答题时，直接走 AI 兜底。
 * 这样用户无需配置题库即可使用 AI 自动答题。
 *
 * @param answererWrappers 题库配置
 * @param env 题目信息
 */
export async function searchAnswersWithAI(
	answererWrappers: AnswererWrapper[],
	env: { type: string; title: string; options?: string; blankCount?: number }
): Promise<SearchInformation[]> {
	const infos =
		answererWrappers && answererWrappers.length !== 0 ? await defaultAnswerWrapperHandler(answererWrappers, env) : [];
	return aiAnswerFallback(env, infos);
}
