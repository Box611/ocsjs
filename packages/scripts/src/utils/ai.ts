import { AnswerWrapperHandlerConfig, defaultAnswerWrapperHandler, request, $ } from '@ocsjs/core';
import type { AnswererWrapper, SearchInformation } from '@ocsjs/core';
import { CommonProject } from '../projects/common';

/**
 * AI 大模型答题配置
 *
 * 配置来源 : 通用 - 全局设置 - AI 大模型自动答题
 */
export interface AIAnswerConfig {
	enabled: boolean;
	url: string;
	apiKey: string;
	model: string;
	prompt: string;
}

/** 读取全局设置中的 AI 大模型配置 */
export function getAIAnswerConfig(): AIAnswerConfig {
	const cfg = CommonProject.scripts.settings.cfg;
	return {
		enabled: cfg.aiAnswer === true,
		url: String(cfg.aiAnswerUrl || '').trim(),
		apiKey: String(cfg.aiAnswerKey || '').trim(),
		model: String(cfg.aiAnswerModel || '').trim(),
		prompt: String(cfg.aiAnswerPrompt || '').trim()
	};
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
	if (!cfg.url) {
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

	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (cfg.apiKey) {
		headers['Authorization'] = cfg.apiKey.startsWith('Bearer ') ? cfg.apiKey : `Bearer ${cfg.apiKey}`;
	}

	const data = {
		model: cfg.model,
		messages: [
			{ role: 'system', content: AI_SYSTEM_PROMPT + (cfg.prompt ? `\n${cfg.prompt}` : '') },
			{ role: 'user', content: userMessage }
		],
		temperature: 0,
		stream: false
	};

	// 优先使用 GM_xmlhttpRequest（用户脚本环境），失败后降级 fetch 重试
	let response: any;
	// eslint-disable-next-line no-undef
	if (typeof GM_xmlhttpRequest !== 'undefined') {
		try {
			response = await Promise.race([
				request(cfg.url, {
					type: 'GM_xmlhttpRequest',
					method: 'post',
					responseType: 'json',
					headers,
					data
				}),
				$.sleep(AnswerWrapperHandlerConfig.timeout_seconds * 1000)
			]);
		} catch (e) {
			console.warn('[ocsjs] AI 接口 GM_xmlhttpRequest 请求失败，尝试使用 fetch 重试 : ', e);
		}
	}
	if (response === undefined) {
		response = await Promise.race([
			request(cfg.url, {
				type: 'fetch',
				method: 'post',
				responseType: 'json',
				headers,
				data
			}),
			$.sleep(AnswerWrapperHandlerConfig.timeout_seconds * 1000)
		]);
	}
	if (response === undefined) {
		throw new Error('AI 接口请求超时，请检查接口地址与网络后重试。');
	}

	// 接口返回错误
	if (response?.error?.message) {
		throw new Error('AI 接口返回错误：' + response.error.message);
	}

	const content = extractAIContent(response);
	if (!content) {
		throw new Error('AI 接口返回内容为空。');
	}

	const answer = extractAnswerByType(content, env.type, env.blankCount);

	return {
		name: 'AI 大模型',
		homepage: cfg.url,
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
				name: 'AI 大模型',
				homepage: cfg.url,
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
		answererWrappers && answererWrappers.length !== 0
			? await defaultAnswerWrapperHandler(answererWrappers, env)
			: [];
	return aiAnswerFallback(env, infos);
}
