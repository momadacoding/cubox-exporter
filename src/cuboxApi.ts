export interface CuboxArticle {
    id: string;
    title: string;
    article_title: string;
    description: string;
    url: string;
    domain: string;
    create_time: string;
    update_time: string;
    word_count: number;
    content?: string;
    cubox_url: string;
    highlights?: CuboxHighlight[];
    tags?: string[];
    type: string;
}

export interface CuboxHighlight {
    id: string;
    text: string;
    image_url?: string;
    cubox_url: string;
    note?: string;
    color: string;
    create_time: string;
}

export interface CuboxFolder {
    id: string;
    name: string;
    nested_name: string;
    uncategorized: boolean;
}

export interface CuboxTag {
    id: string;
    name: string;
    nested_name: string;
    parent_id: string | null;
}

interface ListResponse {
    code: number;
    message: string;
    data: CuboxArticle[];
}

interface ContentResponse {
    code: number;
    message: string;
    data: string;
}

interface FoldersResponse {
    code: number;
    message: string;
    data: CuboxFolder[];
}

interface TagsResponse {
    code: number;
    message: string;
    data: CuboxTag[];
}

export class CuboxApiKeyMissingError extends Error {
    constructor(message = 'Cubox API key is missing or invalid.') {
        super(message);
        this.name = 'CuboxApiKeyMissingError';
    }
}

export class CuboxApi {
    private endpoint: string;
    private apiKey: string;

    constructor(domain: string, apiKey: string) {
        this.endpoint = `https://${domain}`;
        this.apiKey = apiKey;
    }

    private async request(path: string, options: RequestInit = {}) {
        const url = `${this.endpoint}${path}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        return response.json();
    }

    /**
     * 获取文章列表（分页）
     */
    async getArticles(params: {
        lastCardId?: string | null;
        lastCardUpdateTime?: string | null;
        annotated?: boolean;
        folderIds?: string[];
        tagIds?: string[];
        typeFilters?: string[];
    } = {}): Promise<{ articles: CuboxArticle[]; hasMore: boolean }> {
        const pageSize = 50;
        const requestBody: Record<string, unknown> = { limit: pageSize };

        if (params.lastCardId && params.lastCardUpdateTime) {
            requestBody.last_card_id = params.lastCardId;
            requestBody.last_card_update_time = params.lastCardUpdateTime;
        }

        if (params.annotated) requestBody.annotated = true;
        if (params.folderIds?.length) requestBody.group_filters = params.folderIds;
        if (params.tagIds?.length) requestBody.tag_filters = params.tagIds;
        if (params.typeFilters?.length) requestBody.type_filters = params.typeFilters;

        const response = await this.request('/c/api/third-party/card/filter', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        }) as ListResponse;

        if (response.code === -1100) {
            throw new CuboxApiKeyMissingError(response.message || 'API key not found');
        }

        const articles = response.data ?? [];
        return { articles, hasMore: articles.length >= pageSize };
    }

    /**
     * 获取文章详情内容
     */
    async getArticleDetail(articleId: string): Promise<string | null> {
        try {
            const response = await this.request(
                `/c/api/third-party/card/content?id=${articleId}`,
            ) as ContentResponse;
            return response.data;
        } catch (error) {
            console.error(`获取文章 ${articleId} 详情失败:`, error);
            return null;
        }
    }

    /**
     * 获取文件夹列表
     */
    async getFolders(): Promise<CuboxFolder[]> {
        const response = await this.request(
            '/c/api/third-party/group/list',
        ) as FoldersResponse;
        return response.data ?? [];
    }

    /**
     * 获取标签列表
     */
    async getTags(): Promise<CuboxTag[]> {
        const response = await this.request(
            '/c/api/third-party/tag/list',
        ) as TagsResponse;
        return response.data ?? [];
    }
}
