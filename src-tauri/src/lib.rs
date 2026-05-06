mod cubox_api;

use cubox_api::{build_export_data, CuboxApi};
use serde::Serialize;
use std::fs;
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;

/// 进度事件载荷
#[derive(Clone, Serialize)]
struct ProgressPayload {
    stage: String,
    articles: usize,
    pages: usize,
    message: String,
}

/// 导出结果
#[derive(Serialize)]
struct ExportResult {
    total_articles: usize,
    total_highlights: usize,
    file_path: String,
}

/// 导出高亮数据
#[tauri::command]
async fn export_highlights(
    app: tauri::AppHandle,
    domain: String,
    api_key: String,
) -> Result<ExportResult, String> {
    // 校验输入
    if !["cubox.cc", "cubox.pro"].contains(&domain.as_str()) {
        return Err("无效的 Cubox 域名".to_string());
    }
    if api_key.trim().is_empty() {
        return Err("请输入 API Key".to_string());
    }

    let api = CuboxApi::new(&domain, api_key.trim());

    // 通知前端：开始获取
    let _ = app.emit(
        "export-progress",
        ProgressPayload {
            stage: "fetching".to_string(),
            articles: 0,
            pages: 0,
            message: "正在连接 Cubox...".to_string(),
        },
    );

    // 分页获取所有带批注的文章
    let mut all_articles = Vec::new();
    let mut last_card_id: Option<String> = None;
    let mut last_card_update_time: Option<String> = None;
    let mut has_more = true;
    let mut page = 0;

    while has_more {
        page += 1;
        let (articles, more) = api
            .fetch_page(
                last_card_id.as_deref(),
                last_card_update_time.as_deref(),
            )
            .await?;

        if articles.is_empty() {
            break;
        }

        has_more = more;
        if let Some(last) = articles.last() {
            last_card_id = Some(last.id.clone());
            last_card_update_time = last.update_time.clone();
        }

        all_articles.extend(articles);

        let _ = app.emit(
            "export-progress",
            ProgressPayload {
                stage: "fetching".to_string(),
                articles: all_articles.len(),
                pages: page,
                message: format!("已获取 {} 篇文章（第 {} 页）...", all_articles.len(), page),
            },
        );
    }

    // 构建导出数据
    let _ = app.emit(
        "export-progress",
        ProgressPayload {
            stage: "building".to_string(),
            articles: all_articles.len(),
            pages: page,
            message: "正在构建导出数据...".to_string(),
        },
    );

    let export_data = build_export_data(all_articles, &domain);
    let json = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("JSON 序列化失败: {}", e))?;

    let total_articles = export_data.total_articles;
    let total_highlights = export_data.total_highlights;

    // 弹出保存对话框
    let _ = app.emit(
        "export-progress",
        ProgressPayload {
            stage: "saving".to_string(),
            articles: total_articles,
            pages: page,
            message: "请选择保存位置...".to_string(),
        },
    );

    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name("cubox-highlights.json")
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let file_path = rx.await.map_err(|_| "保存对话框异常".to_string())?;
    let file_path = file_path.ok_or("已取消保存".to_string())?;

    // 写入文件
    let path_buf = file_path.as_path().ok_or("无效的文件路径")?.to_path_buf();
    fs::write(&path_buf, &json).map_err(|e| format!("文件保存失败: {}", e))?;

    let path_str = path_buf.display().to_string();

    let _ = app.emit(
        "export-progress",
        ProgressPayload {
            stage: "done".to_string(),
            articles: total_articles,
            pages: page,
            message: format!(
                "导出完成！{} 篇文章，{} 条高亮",
                total_articles, total_highlights,
            ),
        },
    );

    Ok(ExportResult {
        total_articles,
        total_highlights,
        file_path: path_str,
    })
}

/// 验证 API Key 是否有效
#[tauri::command]
async fn validate_api_key(domain: String, api_key: String) -> Result<bool, String> {
    if api_key.trim().is_empty() {
        return Err("请输入 API Key".to_string());
    }
    let api = CuboxApi::new(&domain, api_key.trim());
    // 尝试获取第一页，无报错即认为有效
    let _ = api.fetch_page(None, None).await?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_highlights, validate_api_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
