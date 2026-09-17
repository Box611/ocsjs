import { $ui, h } from 'easy-us';

/**
 * AI 供应商预设
 *
 * 脚本只支持 OpenAI 兼容协议（POST /chat/completions），
 * 因此这里只维护 baseUrl、默认模型列表以及文档地址。
 */
export interface AIProvider {
	/** 供应商标识，会被持久化到配置中，请勿随意修改 */
	id: string;
	/** 供应商名称 */
	name: string;
	/**
	 * OpenAI 兼容接口的基础地址
	 *
	 * 最终请求地址 = baseUrl + '/chat/completions'，
	 * 空字符串表示需要用户手动填写完整接口地址（自定义供应商）。
	 */
	baseUrl: string;
	/** 常见模型列表，第一项为该供应商的默认模型 */
	models: string[];
	/** 文档地址，用于「查看文档」跳转 */
	docs?: string;
	/** 该供应商 API Key 的获取地址 */
	keyUrl?: string;
	/**
	 * 鉴权头类型
	 *
	 * - bearer : `Authorization: Bearer <apiKey>`（绝大多数供应商）
	 * - api-key : `api-key: <apiKey>`（部分 Azure / 腾讯系网关）
	 */
	auth?: 'bearer' | 'api-key';
}

/** 内置供应商列表 */
export const AI_PROVIDERS: AIProvider[] = [
	{
		id: 'deepseek',
		name: 'DeepSeek 深度求索',
		baseUrl: 'https://api.deepseek.com/v1',
		models: ['deepseek-chat', 'deepseek-reasoner'],
		docs: 'https://api-docs.deepseek.com/zh-cn/',
		keyUrl: 'https://platform.deepseek.com/api_keys'
	},
	{
		id: 'tencent-token-plan',
		name: '腾讯云 Token Plan / 通用 Token Plan（个人版）',
		baseUrl: 'https://api.lkeap.cloud.tencent.com/v1',
		models: ['Auto', 'deepseek-v3', 'deepseek-r1', 'hunyuan-turbos-latest'],
		docs: 'https://cloud.tencent.com/document/product/1772',
		keyUrl: 'https://console.cloud.tencent.com/lkeap'
	},
	{
		id: 'moonshot',
		name: 'Kimi 月之暗面（Moonshot）',
		baseUrl: 'https://api.moonshot.cn/v1',
		models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2-0905-preview'],
		docs: 'https://platform.moonshot.cn/docs',
		keyUrl: 'https://platform.moonshot.cn/console/api-keys'
	},
	{
		id: 'qwen',
		name: '阿里云百炼 通义千问（DashScope）',
		baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
		models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
		docs: 'https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope',
		keyUrl: 'https://bailian.console.aliyun.com/'
	},
	{
		id: 'zhipu',
		name: '智谱 AI（GLM）',
		baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
		models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4-long'],
		docs: 'https://open.bigmodel.cn/dev/api',
		keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys'
	},
	{
		id: 'siliconflow',
		name: '硅基流动（SiliconFlow）',
		baseUrl: 'https://api.siliconflow.cn/v1',
		models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-7B-Instruct', 'THUDM/glm-4-9b-chat'],
		docs: 'https://docs.siliconflow.cn/',
		keyUrl: 'https://cloud.siliconflow.cn/account/ak'
	},
	{
		id: 'openai',
		name: 'OpenAI',
		baseUrl: 'https://api.openai.com/v1',
		models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
		docs: 'https://platform.openai.com/docs/api-reference/chat',
		keyUrl: 'https://platform.openai.com/api-keys'
	},
	{
		id: 'ollama',
		name: 'Ollama 本地模型',
		baseUrl: 'http://127.0.0.1:11434/v1',
		models: ['qwen2.5', 'llama3.1', 'deepseek-r1'],
		docs: 'https://github.com/ollama/ollama/blob/main/docs/openai.md'
	},
	{
		id: 'custom',
		name: '自定义（OpenAI 兼容接口）',
		baseUrl: '',
		models: [],
		docs: 'https://platform.openai.com/docs/api-reference/chat'
	}
];

/** 默认供应商 */
export const DEFAULT_AI_PROVIDER_ID = 'deepseek';

/** 通过 id 获取供应商预设，找不到时返回自定义供应商 */
export function getAIProvider(id: string | undefined): AIProvider {
	return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[AI_PROVIDERS.length - 1];
}

/**
 * 根据供应商和用户填写的接口地址，解析出最终的 chat/completions 地址
 *
 * 兼容以下写法：
 * - 留空          -> 使用供应商预设的 baseUrl
 * - 只填 baseUrl  -> 自动拼接 /chat/completions
 * - 填完整地址    -> 原样使用
 */
export function resolveAIEndpoint(provider: AIProvider, url: string): string {
	const raw = String(url || '').trim();
	let base = raw;

	if (!base) {
		base = provider.baseUrl;
	}
	if (!base) {
		return '';
	}

	// 去除末尾多余的斜杠
	base = base.replace(/\/+$/, '');

	// 已经是完整的 chat/completions 地址
	if (/\/chat\/completions$/i.test(base)) {
		return base;
	}

	// Ollama 等原生地址缺少 /v1 时补齐
	if (/\/v\d+$/i.test(base) === false && /\/v\d+\//i.test(base) === false) {
		return base + '/v1/chat/completions';
	}

	return base + '/chat/completions';
}

/** 根据供应商生成鉴权请求头 */
export function createAIHeaders(provider: AIProvider, apiKey: string): Record<string, string> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const key = String(apiKey || '').trim();
	if (!key) {
		return headers;
	}
	if (key.startsWith('Bearer ') || key.startsWith('bearer ')) {
		headers['Authorization'] = key;
		return headers;
	}
	if (provider.auth === 'api-key') {
		headers['api-key'] = key;
		return headers;
	}
	headers['Authorization'] = `Bearer ${key}`;
	return headers;
}

/**
 * 生成「查看文档」链接元素
 *
 * 使用 span 而不是 a 标签，避免部分网课页面的全局点击拦截，
 * 点击后通过 window.open 打开新标签页。
 */
export function createDocLink(url: string | undefined, text = '查看文档') {
	if (!url) {
		return h('span', { className: 'secondary' });
	}
	const link = h('span', { className: 'ai-doc-link', title: url }, [text, ' ↗']);
	link.onclick = () => window.open(url, '_blank');
	return $ui.tooltip(link);
}
