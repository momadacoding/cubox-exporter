#!/usr/bin/env node

import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFile } from 'node:fs/promises';
import { CuboxApi, CuboxApiKeyMissingError, CuboxArticle } from './cuboxApi';

/** 导出的高亮条目 */
interface ExportHighlight {
    id: string;
    text: string;
    note: string;
    color: string;
    create_time: string;
    cubox_url: string;
}

/** 导出的文章条目 */
interface ExportArticle {
    id: string;
    title: string;
    url: string;
    domain: string;
    cubox_url: string;
    create_time: string;
    tags: string[];
    highlights: ExportHighlight[];
}

/** 导出文件顶层结构 */
interface ExportData {
    source: 'cubox';
    schema_version: number;
    exported_at: string;
    cubox_domain: string;
    total_articles: number;
    total_highlights: number;
    articles: ExportArticle[];
}

const VALID_DOMAINS = ['cubox.cc', 'cubox.pro'] as const;

async function promptForOptions(defaults: { domain: string }) {
    const rl = readline.createInterface({ input: stdin, output: stdout });

    try {
        console.log('\nCubox Highlights Exporter\n');

        const domainChoice = await rl.question(
            'Select Cubox region (1: cubox.cc, 2: cubox.pro) [1]: ',
        );
        const domain = domainChoice.trim() === '2' ? 'cubox.pro' : 'cubox.cc';

        const apiKey = await rl.question('Enter your Cubox API key: ');
        if (!apiKey.trim()) {
            console.error('API key is required.');
            process.exit(1);
        }

        return { domain, apiKey: apiKey.trim() };
    } finally {
        rl.close();
    }
}

async function fetchAllAnnotatedArticles(api: CuboxApi): Promise<CuboxArticle[]> {
    const allArticles: CuboxArticle[] = [];
    let lastCardId: string | null = null;
    let lastCardUpdateTime: string | null = null;
    let hasMore = true;
    let page = 0;

    while (hasMore) {
        page++;
        const { articles, hasMore: more } = await api.getArticles({
            lastCardId,
            lastCardUpdateTime,
            annotated: true,
        });

        if (articles.length === 0) break;

        allArticles.push(...articles);
        process.stdout.write(`\r  Fetched ${allArticles.length} articles (page ${page})...`);

        hasMore = more;
        lastCardId = articles[articles.length - 1].id;
        lastCardUpdateTime = articles[articles.length - 1].update_time;
    }

    console.log('');
    return allArticles;
}

function buildExportData(articles: CuboxArticle[], domain: string): ExportData {
    const withHighlights = articles.filter(
        (a) => a.highlights && a.highlights.length > 0,
    );

    return {
        source: 'cubox',
        schema_version: 1,
        exported_at: new Date().toISOString(),
        cubox_domain: domain,
        total_articles: withHighlights.length,
        total_highlights: withHighlights.reduce(
            (sum, a) => sum + (a.highlights?.length ?? 0),
            0,
        ),
        articles: withHighlights.map((a) => ({
            id: a.id || '',
            title: a.title || a.article_title || '',
            url: a.url || '',
            domain: a.domain || '',
            cubox_url: a.cubox_url || '',
            create_time: a.create_time || '',
            tags: a.tags || [],
            highlights: (a.highlights || []).map((h) => ({
                id: h.id || '',
                text: h.text || '',
                note: h.note || '',
                color: h.color || '',
                create_time: h.create_time || '',
                cubox_url: h.cubox_url || '',
            })),
        })),
    };
}

const program = new Command();

program
    .name('cubox-export')
    .description('Export Cubox highlights to JSON')
    .version('1.0.0')
    .option('-k, --api-key <key>', 'Cubox API key')
    .option('-d, --domain <domain>', 'Cubox domain (cubox.cc or cubox.pro)', 'cubox.cc')
    .option('-o, --output <file>', 'Output file path', 'cubox-highlights.json')
    .action(async (options) => {
        let { apiKey, domain, output } = options;

        // 如果没提供 API key，进入交互模式
        if (!apiKey) {
            const prompted = await promptForOptions({ domain });
            apiKey = prompted.apiKey;
            domain = prompted.domain;
        }

        if (!VALID_DOMAINS.includes(domain)) {
            console.error(`Invalid domain "${domain}". Must be cubox.cc or cubox.pro`);
            process.exit(1);
        }

        const api = new CuboxApi(domain, apiKey);
        console.log(`\nFetching highlights from ${domain}...`);

        try {
            const articles = await fetchAllAnnotatedArticles(api);
            const exportData = buildExportData(articles, domain);

            await writeFile(output, JSON.stringify(exportData, null, 2), 'utf-8');

            console.log(
                `\nDone! ${exportData.total_highlights} highlights from ${exportData.total_articles} articles`,
            );
            console.log(`Output: ${output}`);
        } catch (error) {
            if (error instanceof CuboxApiKeyMissingError) {
                console.error('\nInvalid API key. Please check and try again.');
            } else {
                console.error(
                    '\nExport failed:',
                    error instanceof Error ? error.message : error,
                );
            }
            process.exit(1);
        }
    });

program.parse();
