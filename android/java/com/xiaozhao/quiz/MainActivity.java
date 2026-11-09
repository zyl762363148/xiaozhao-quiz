package com.xiaozhao.quiz;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * 小赵勇争第一 · 安卓外壳
 * 只有一个 WebView，加载打包进 assets 的单文件页面；
 * 数据全部存在 WebView 的 localStorage 里（绝对路径、不联网也能用）。
 */
public class MainActivity extends Activity {

    private static final String BASE_URL = "https://xiaozhao.quiz/";
    private WebView web;
    private long lastBackAt = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#7A5AF5"));
        w.setNavigationBarColor(Color.parseColor("#F5F2FD"));

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.setBackgroundColor(Color.parseColor("#F5F2FD"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient());
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

    /** 把 assets/index.html 灌进去；用 https 假域名做 base，localStorage 才能稳定持久化 */
    private void loadApp() {
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
                            .setPositiveButton("退出", new DialogInterface.OnClickListener() {
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
