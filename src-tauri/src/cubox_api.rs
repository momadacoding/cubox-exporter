use reqwest::Client;
use serde::{Deserialize, Serialize};

/// Cubox API 返回的文章
#[derive(Debug, Deserialize)]
pub struct CuboxArticle {
    pub id: String,
    pub title: Option<String>,
    pub article_title: Option<String>,
    pub url: Option<String>,
    pub domain: Option<String>,
    pub create_time: Option<String>,
    pub update_time: Option<String>,
    pub cubox_url: Option<String>,
    pub highlights: Option<Vec<CuboxHighlight>>,
    pub tags: Option<Vec<serde_json::Value>>,
}

/// Cubox API 返回的高亮
#[derive(Debug, Deserialize)]
pub struct CuboxHighlight {
    pub id: String,
    pub text: Option<String>,
    pub note: Option<String>,
    pub color: Option<String>,
    pub create_time: Option<String>,
    pub cubox_url: Option<String>,
}

/// API 响应结构
#[derive(Debug, Deserialize)]
struct ApiResponse {
    code: Option<i32>,
    #[allow(dead_code)]
    message: Option<String>,
    data: Option<Vec<CuboxArticle>>,
}

// ============================================================================
// 导出格式（与 Acorny cuboxAdapter 兼容）
// ============================================================================

#[derive(Debug, Serialize)]
pub struct ExportData {
    pub source: String,
    pub schema_version: u32,
    pub exported_at: String,
    pub cubox_domain: String,
    pub total_articles: usize,
    pub total_highlights: usize,
    pub articles: Vec<ExportArticle>,
}

#[derive(Debug, Serialize)]
pub struct ExportArticle {
    pub id: String,
    pub title: String,
    pub url: String,
    pub domain: String,
    pub cubox_url: String,
    pub create_time: String,
    pub tags: Vec<String>,
    pub highlights: Vec<ExportHighlight>,
}

#[derive(Debug, Serialize)]
pub struct ExportHighlight {
    pub id: String,
    pub text: String,
    pub note: String,
    pub color: String,
    pub create_time: String,
    pub cubox_url: String,
}

// ============================================================================
// API 客户端
// ============================================================================

pub struct CuboxApi {
    client: Client,
    endpoint: String,
    api_key: String,
}

impl CuboxApi {
    pub fn new(domain: &str, api_key: &str) -> Self {
        Self {
            client: Client::new(),
            endpoint: format!("https://{}", domain),
            api_key: api_key.to_string(),
        }
    }

    /// 获取一页带批注的文章
    pub async fn fetch_page(
        &self,
        last_card_id: Option<&str>,
        last_card_update_time: Option<&str>,
    ) -> Result<(Vec<CuboxArticle>, bool), String> {
        let mut body = serde_json::json!({
            "limit": 50,
            "annotated": true,
        });

        if let (Some(id), Some(time)) = (last_card_id, last_card_update_time) {
            body["last_card_id"] = serde_json::json!(id);
            body["last_card_update_time"] = serde_json::json!(time);
        }

        let response = self
            .client
            .post(format!("{}/c/api/third-party/card/filter", self.endpoint))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("网络请求失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("API 请求失败: HTTP {}", response.status()));
        }

        let api_response: ApiResponse = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        if api_response.code == Some(-1100) {
            return Err("API Key 无效或已过期，请检查后重试".to_string());
        }

        let articles = api_response.data.unwrap_or_default();
        let has_more = articles.len() >= 50;
        Ok((articles, has_more))
    }
}

// ============================================================================
// 数据转换
// ============================================================================

/// 将 tags 字段转换为字符串数组（兼容字符串和对象两种格式）
fn tags_to_strings(tags: Option<Vec<serde_json::Value>>) -> Vec<String> {
    tags.unwrap_or_default()
        .into_iter()
        .filter_map(|v| match v {
            serde_json::Value::String(s) => Some(s),
            serde_json::Value::Object(obj) => {
                obj.get("name").and_then(|n| n.as_str()).map(String::from)
            }
            _ => None,
        })
        .collect()
}

/// 构建 Acorny 兼容的导出数据
pub fn build_export_data(articles: Vec<CuboxArticle>, domain: &str) -> ExportData {
    let with_highlights: Vec<_> = articles
        .into_iter()
        .filter(|a| a.highlights.as_ref().map_or(false, |h| !h.is_empty()))
        .collect();

    let total_highlights: usize = with_highlights
        .iter()
        .map(|a| a.highlights.as_ref().map_or(0, |h| h.len()))
        .sum();

    let export_articles: Vec<ExportArticle> = with_highlights
        .into_iter()
        .map(|a| {
            let highlights = a
                .highlights
                .unwrap_or_default()
                .into_iter()
                .map(|h| ExportHighlight {
                    id: h.id,
                    text: h.text.unwrap_or_default(),
                    note: h.note.unwrap_or_default(),
                    color: h.color.unwrap_or_default(),
                    create_time: h.create_time.unwrap_or_default(),
                    cubox_url: h.cubox_url.unwrap_or_default(),
                })
                .collect();

            ExportArticle {
                id: a.id,
                title: a.title.or(a.article_title).unwrap_or_default(),
                url: a.url.unwrap_or_default(),
                domain: a.domain.unwrap_or_default(),
                cubox_url: a.cubox_url.unwrap_or_default(),
                create_time: a.create_time.unwrap_or_default(),
                tags: tags_to_strings(a.tags),
                highlights,
            }
        })
        .collect();

    ExportData {
        source: "cubox".to_string(),
        schema_version: 1,
        exported_at: chrono::Utc::now().to_rfc3339(),
        cubox_domain: domain.to_string(),
        total_articles: export_articles.len(),
        total_highlights,
        articles: export_articles,
    }
}
