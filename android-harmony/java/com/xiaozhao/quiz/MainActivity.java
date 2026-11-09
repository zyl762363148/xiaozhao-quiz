package com.xiaozhao.quiz;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * 小赵勇争第一 · 鸿蒙（HarmonyOS）兼容外壳
 *
 * 与标准版 android/java/.../MainActivity.java 的差异：
 * A. 加载方式改为「拦截式本地加载」：WebView 访问 https://xiaozhao.quiz/ 这个真实
 *    origin，由 shouldInterceptRequest 把 assets/index.html 返回给它。这样规避了
 *    鸿蒙 WebView 对 loadDataWithBaseURL 超长 data（单文件页面约 1.3MB）的长度限制，
 *    并让 localStorage 落在稳定的 https origin 上，练习记录不会丢。
 *    同时保留 2.5 秒兜底：个别 ROM 不回调拦截时自动退回 loadDataWithBaseURL。
 * B. WebSettings 放宽：allowFileAccess / allowContentAccess / universalAccess /
 *    mixedContent，鸿蒙对内联 data:、blob: 与混合内容校验更严；
 *    mediaPlaybackRequiresUserGesture=false 让 Web Audio 答题音效即时生效。
 * C. 显式 LAYER_TYPE_HARDWARE，避免部分鸿蒙机型 WebView 走软件渲染导致白屏/卡顿。
 * D. 关闭密码保存、禁止自动开窗；API 29+ 关闭导航栏对比度强制（鸿蒙全面屏手势条）。
 *
 * 功能逻辑（JS 对话框、返回键、页面内容）与标准版完全一致，仍为单 WebView、零网络权限。
 */
public class MainActivity extends Activity {

    private static final String BASE_URL = "https://xiaozhao.quiz/";
    private WebView web;
    private long lastBackAt = 0;
    private volatile boolean pageReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#7A5AF5"));
        w.setNavigationBarColor(Color.parseColor("#F5F2FD"));
        if (Build.VERSION.SDK_INT >= 29) {
            w.setNavigationBarContrastEnforced(false);
        }

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setDefaultTextEncodingName("UTF-8");
        // 鸿蒙兼容：以下四项标准版为 false / 默认，这里显式放开
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSavePassword(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.setBackgroundColor(Color.parseColor("#F5F2FD"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            // 老重载（部分鸿蒙 ROM 仍走这条）
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                if (BASE_URL.equals(url)) return localResponse();
                return super.shouldInterceptRequest(view, url);
            }

            // 新重载（API 21+，minSdk 24 起主流走这条）
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null
                        && BASE_URL.equals(request.getUrl().toString())) {
                    return localResponse();
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // 只留在本地 origin 内；外链一律不加载（本应用也不需要联网）
                return url == null || !url.startsWith(BASE_URL);
            }
        });

        // 默认 WebChromeClient 不实现 JS 对话框，confirm() 会恒返回 false —— 交卷/退出确认全部失效
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, android.webkit.JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("确定", new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface d, int i) { result.confirm(); }
                    })
                    .setOnCancelListener(new DialogInterface.OnCancelListener() {
                        public void onCancel(DialogInterface d) { result.cancel(); }
                    })
                    .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, android.webkit.JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setNegativeButton("取消", new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface d, int i) { result.cancel(); }
                    })
                    .setPositiveButton("确定", new DialogInterface.OnClickListener() {
                        public void onClick(DialogInterface d, int i) { result.confirm(); }
                    })
                    .setOnCancelListener(new DialogInterface.OnCancelListener() {
                        public void onCancel(DialogInterface d) { result.cancel(); }
                    })
                    .show();
                return true;
            }
        });

        setContentView(web);
        loadApp();
    }

    /** 把 assets/index.html 作为 https://xiaozhao.quiz/ 的响应返回 */
    private WebResourceResponse localResponse() {
        try {
            InputStream in = getAssets().open("index.html");
            return new WebResourceResponse("text/html", "UTF-8", in);
        } catch (Exception e) {
            return null;
        }
    }

    /** 拦截式加载 + 兜底：个别鸿蒙 ROM 不回调 shouldInterceptRequest 时自动退回标准方式 */
    private void loadApp() {
        web.loadUrl(BASE_URL);
        web.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!pageReady) loadFallback();
            }
        }, 2500);
    }

    private void loadFallback() {
        try {
            InputStream in = getAssets().open("index.html");
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            in.close();
            String html = bo.toString("UTF-8");
            web.loadDataWithBaseURL(BASE_URL, html, "text/html", "UTF-8", null);
        } catch (Exception e) {
            Toast.makeText(this, "页面加载失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    /** 返回键：答题中先问，子页面先回首页，首页再按一次才退出 */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){try{var s=window.__XZ&&window.__XZ.state;" +
            "if(s&&((s.quiz&&!s.quiz.finished)||(s.paper&&!s.paper.finished)))return 'busy';" +
            "var a=document.querySelector('.view.is-active');" +
            "if(a&&a.id!=='view-home')return 'sub';return 'home';}catch(e){return 'home';}})()",
            new android.webkit.ValueCallback<String>() {
                @Override
                public void onReceiveValue(String v) {
                    String r = v == null ? "home" : v.replace("\"", "");
                    if ("busy".equals(r)) {
                        new AlertDialog.Builder(MainActivity.this)
                            .setMessage("这一局还没交卷，退出就不算成绩了。")
                            .setNegativeButton("继续答题", null)
                            .setPositiveButton("确定", new DialogInterface.OnClickListener() {
                                public void onClick(DialogInterface d, int i) { finish(); }
                            })
                            .show();
                    } else if ("sub".equals(r)) {
                        web.evaluateJavascript(
                            "document.querySelector('#tabbar [data-tab=\"home\"]').click();", null);
                    } else {
                        long now = System.currentTimeMillis();
                        if (now - lastBackAt < 1800) {
                            finish();
                        } else {
                            lastBackAt = now;
                            Toast.makeText(MainActivity.this, "再按一次退出", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }
}
