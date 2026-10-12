package kr.cleantouch.scan.search

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import kr.cleantouch.scan.capture.FloatingScanService
import kr.cleantouch.scan.BuildConfig

/** Sends only the selected product crop to Google's official image-search page. */
class LensSearchActivity : ComponentActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var imageUri: Uri
    private lateinit var imageBase64: String
    private lateinit var imageMimeType: String
    private lateinit var webView: WebView
    private lateinit var status: TextView
    private lateinit var retry: Button
    private var uploadAttempted = false
    private var uploadStarted = false
    private var resultSeen = false
    private var uploadGeneration = 0
    private var pageRetries = 0
    private lateinit var mobileAgent: String

    override fun onResume() {
        super.onResume()
        // The overlay must stay visible through startActivity, then disappear after this Activity is foreground.
        FloatingScanService.hide(this)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)
        mobileAgent = WebSettings.getDefaultUserAgent(this)
        imageUri = intent.getStringExtra(EXTRA_IMAGE_URI)?.let(Uri::parse)
            ?: run { finish(); return }
        imageMimeType = intent.getStringExtra(EXTRA_IMAGE_MIME_TYPE)?.takeIf { it == "image/png" } ?: "image/jpeg"
        if (imageUri.scheme != "content" || imageUri.authority != "$packageName.fileprovider") {
            finish(); return
        }
        imageBase64 = runCatching {
            contentResolver.openInputStream(imageUri)?.use { input -> Base64.encodeToString(input.readBytes(), Base64.NO_WRAP) }
        }.getOrNull()?.takeIf { it.isNotBlank() && it.length <= 8 * 1024 * 1024 }
            ?: run { finish(); return }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = closeLens()
        })

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(18, 18, 31))
        }
        val header = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(16), dp(8), dp(16), dp(8))
        }
        header.addView(TextView(this).apply {
            text = "Google Lens · 비슷한 상품"
            textSize = 17f
            setTextColor(Color.WHITE)
        }, LinearLayout.LayoutParams(0, dp(48), 1f))
        header.addView(Button(this).apply {
            text = "닫기"
            setOnClickListener { closeLens() }
        })
        root.addView(header)
        status = TextView(this).apply {
            text = "선택한 상품 사진을 Google Lens에 전달하고 있어요."
            textSize = 13f
            setTextColor(Color.rgb(190, 183, 220))
            setPadding(dp(16), dp(8), dp(16), dp(8))
        }
        root.addView(status)
        val aiSummary=TextView(this).apply{
            text="선택한 상품을 AI로 확인하고 있어요. 상품 이미지는 Gemini에 전송됩니다."
            textSize=13f;maxLines=4;ellipsize=android.text.TextUtils.TruncateAt.END;setTextColor(Color.rgb(115,223,193));setPadding(dp(16),dp(6),dp(16),dp(6))
        }
        root.addView(aiSummary)
        val shopping=Button(this).apply{visibility=View.GONE}
        root.addView(shopping)
        val askAi=Button(this).apply{text="AI에게 상품 더 물어보기";visibility=View.GONE}
        root.addView(askAi)
        lifecycleScope.launch {
            try {
                val bitmap=withContext(Dispatchers.IO){val bytes=Base64.decode(imageBase64,Base64.NO_WRAP);val raw=android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size)?:error("이미지를 읽지 못했어요.");val opaque=Bitmap.createBitmap(raw.width,raw.height,Bitmap.Config.ARGB_8888);android.graphics.Canvas(opaque).apply{drawColor(Color.WHITE);drawBitmap(raw,0f,0f,null)};raw.recycle();opaque}
                val (result,chatFile)=try{
                    val result=PlaceChatRepository.identifyProduct(bitmap)
                    val file=withContext(Dispatchers.IO){val folder=java.io.File(filesDir,"sessions/product-chat").apply{mkdirs()};folder.listFiles()?.filter{it.lastModified()<System.currentTimeMillis()-86_400_000L}?.forEach{it.delete()};java.io.File(folder,"${java.util.UUID.randomUUID()}.jpg").apply{outputStream().use{bitmap.compress(Bitmap.CompressFormat.JPEG,85,it)}}}
                    result to file
                }finally{bitmap.recycle()}
                aiSummary.text="${result.label}${if(result.confidence=="low")" · 종류 확인 필요" else " · AI 추정"}\n${result.reason}"
                if(result.query.isNotBlank()){shopping.text="${result.query} · 쇼핑 검색";shopping.visibility=View.VISIBLE;shopping.setOnClickListener{startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://www.google.com/search?tbm=shop&q=${Uri.encode(result.query)}")))}}
                askAi.visibility=View.VISIBLE;askAi.setOnClickListener{
                    val restore=intent.getBooleanExtra(EXTRA_RESTORE_FLOATING_BUTTON,false)
                    startActivity(Intent(this@LensSearchActivity,PlaceChatActivity::class.java).putExtra("scene",chatFile.absolutePath).putExtra("product",true).putExtra("productLabel",result.label).putExtra("productReason",result.reason).putExtra("restoreWidget",restore))
                    intent.putExtra(EXTRA_RESTORE_FLOATING_BUTTON,false);finish()
                }
            }catch(error:Exception){if(error is kotlinx.coroutines.CancellationException)throw error;aiSummary.text="AI 상품 확인을 사용할 수 없어 Lens 이미지 검색으로 진행합니다."}
        }
        retry = Button(this).apply {
            text = "자동 전송 다시 시도"
            visibility = View.GONE
            setOnClickListener {
                uploadAttempted = false
                uploadStarted = false
                resultSeen = false
                retry.visibility = View.GONE
                webView.settings.userAgentString = uploadAgent()
                webView.loadUrl("https://www.google.com/imghp?hl=ko")
            }
        }
        root.addView(retry)
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = true
        }
        root.addView(progress, LinearLayout.LayoutParams(-1, dp(2)))
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            // Google's mobile landing page may offer only its app, with no image file input.
            // Use the web upload form, then restore the mobile UA for the results page.
            settings.userAgentString = uploadAgent()
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams,
                ): Boolean {
                    if (!isUploadPage(view.url)) { filePathCallback.onReceiveValue(null); return true }
                    filePathCallback.onReceiveValue(arrayOf(imageUri))
                    uploadStarted = true
                    status.text = "상품 사진을 Lens에 보냈어요. 검색 결과를 불러오는 중입니다."
                    retry.visibility = View.GONE
                    handler.postDelayed({
                        if (!isFinishing && !resultSeen && uploadStarted) {
                            status.text = "Lens 응답을 기다리고 있어요. 계속 멈춰 있으면 다시 시도해 주세요."
                            retry.visibility = View.VISIBLE
                        }
                    }, 20000)
                    return true
                }

                override fun onProgressChanged(view: WebView, newProgress: Int) {
                    progress.progress = newProgress
                    progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
                }
            }
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                    uploadGeneration++
                    super.onPageStarted(view, url, favicon)
                }
                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    if (request.isForMainFrame) {
                        status.text = "검색 화면을 불러오지 못했어요. 인터넷 연결 후 다시 시도해 주세요."; retry.visibility = View.VISIBLE
                        if(!uploadStarted&&pageRetries<1&&isUploadPage(request.url.toString())){pageRetries++;handler.postDelayed({if(!isFinishing){uploadAttempted=false;view.loadUrl(request.url.toString())}},750)}
                    }
                }
                override fun onPageCommitVisible(view:WebView,url:String){super.onPageCommitVisible(view,url);beginUpload(view,url)}
                override fun onReceivedHttpError(view:WebView,request:WebResourceRequest,response:WebResourceResponse){
                    if(request.isForMainFrame&&response.statusCode>=400){status.text="Google 이미지 검색이 일시적으로 응답하지 않아요. 쇼핑 검색을 이용하거나 다시 시도해 주세요.";retry.visibility=View.VISIBLE}
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val destination = request.url
                    if (destination.scheme == "intent") {
                        val link = runCatching { Intent.parseUri(destination.toString(), Intent.URI_INTENT_SCHEME) }.getOrNull()
                        val fallback = link?.getStringExtra("browser_fallback_url")?.let(Uri::parse)
                        if (fallback?.scheme == "https" && isGoogleHost(fallback.host.orEmpty())) { view.loadUrl(fallback.toString()); return true }
                        val target = link?.`package`
                        if (target in setOf("com.google.android.googlequicksearchbox", "com.google.ar.lens") && link?.data != null) {
                            runCatching { startActivity(Intent(Intent.ACTION_VIEW, link.data).setPackage(target)) }
                                .onFailure { status.text = "Google 앱 연결을 열지 못했어요. 웹 검색을 다시 시도해 주세요."; retry.visibility = View.VISIBLE }
                        } else { status.text = "이 링크를 열 수 없어요. 웹 검색을 다시 시도해 주세요."; retry.visibility = View.VISIBLE }
                        return true
                    }
                    if (destination.scheme !in setOf("https", "http")) return true
                    if (isGoogleHost(destination.host.orEmpty())) return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, destination)) }
                    return true
                }

                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    if (uploadStarted && url.contains("/sorry/")) {
                        status.text = "Google에서 추가 확인을 요청했어요. 화면 안내를 마친 뒤 Lens 결과를 확인하세요."
                        retry.visibility = View.GONE
                    } else if (isResultPage(url)) {
                        resultSeen = true
                        if (view.settings.userAgentString != mobileAgent) view.settings.userAgentString = mobileAgent
                        status.text = "Lens 결과를 확인하세요. 쇼핑몰 링크는 브라우저에서 열립니다."
                        retry.visibility = View.GONE
                    } else beginUpload(view,url)
                }
            }
        }
        root.addView(webView, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom); insets
        }
        webView.loadUrl("https://www.google.com/imghp?hl=ko")
    }

    private fun beginUpload(view:WebView,url:String){
        if(uploadAttempted||uploadStarted||resultSeen||!isUploadPage(url))return
        uploadAttempted=true
        view.evaluateJavascript("window.__cleanTouchImageBase64='${imageBase64}'"){requestUploadControl()}
    }

    private fun uploadAgent(): String {
        val chrome = Regex("Chrome/[0-9.]+").find(mobileAgent)?.value ?: "Chrome/132.0.0.0"
        return "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) $chrome Safari/537.36"
    }

    private fun requestUploadControl(attempt: Int = 0) {
        if (isFinishing || !::webView.isInitialized || uploadStarted || resultSeen || !isUploadPage(webView.url)) return
        val generation = uploadGeneration
        webView.evaluateJavascript(
            """(() => {
                const input = document.querySelector('input[type="file"][name="encoded_image"]') || document.querySelector('input[type="file"]');
                if (input) {
                    try {
                        if (!window.__cleanTouchChooserOpened) {
                            window.__cleanTouchChooserOpened = true;
                            input.click();
                            return 'chooser';
                        }
                        const raw = atob(window.__cleanTouchImageBase64 || '');
                        const bytes = new Uint8Array(raw.length);
                        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                        const png = '${imageMimeType}' === 'image/png';
                        const file = new File([bytes], png ? 'CleanTouch-product.png' : 'CleanTouch-product.jpg', {type:'${imageMimeType}'});
                        const transfer = new DataTransfer();
                        transfer.items.add(file);
                        input.files = transfer.files;
                        input.dispatchEvent(new Event('input', {bubbles:true}));
                        input.dispatchEvent(new Event('change', {bubbles:true}));
                        window.__cleanTouchImageBase64 = '';
                        return 'upload';
                    } catch (error) { return 'error:' + String(error); }
                }
                if (!window.__cleanTouchOpenedImageSearch) {
                    const controls = [...document.querySelectorAll('button,[role="button"],[aria-label],[title]')];
                    const button = controls.find(el => /이미지로 검색|search by image/i.test(
                        [el.getAttribute('aria-label'), el.innerText, el.getAttribute('title')].filter(Boolean).join(' ')));
                    if (button) { window.__cleanTouchOpenedImageSearch = true; button.click(); }
                }
                return 'wait';
            })()""".trimIndent(),
        ) { result ->
            if (isFinishing || generation != uploadGeneration || resultSeen) return@evaluateJavascript
            if (result == "\"upload\"") {
                uploadStarted = true
                status.text = "상품 사진을 Lens에 전달하고 있어요."
                val uploadPage = webView.url
                handler.postDelayed({
                    if (uploadStarted && !resultSeen && !isFinishing && webView.url == uploadPage) {
                        status.text = "Lens 응답을 기다리고 있어요. 계속 멈춰 있으면 다시 시도해 주세요."
                        retry.visibility = View.VISIBLE
                    }
                }, 12_000)
            } else if (attempt < 60) {
                handler.postDelayed({ requestUploadControl(attempt + 1) }, 250)
            } else if (!uploadStarted && !isFinishing) {
                status.text = "Google Lens 이미지 검색창을 열지 못했어요. ${result.take(140)}"
                retry.visibility = View.VISIBLE
            }
        }
    }

    private fun isUploadPage(url: String?): Boolean {
        val uri = url?.let(Uri::parse) ?: return false
        return uri.scheme == "https" && uri.host in setOf("www.google.com", "www.google.co.kr", "lens.google.com") && !isResultPage(url)
    }
    private fun isResultPage(url: String): Boolean {
        val uri = Uri.parse(url)
        return (uri.host == "lens.google.com" && uri.path?.startsWith("/search") == true) ||
            (uri.host in setOf("www.google.com", "www.google.co.kr") && uri.path == "/search" && (uri.getQueryParameter("lns_surface") != null || uri.getQueryParameter("vsrid") != null || uri.getQueryParameter("udm") != null))
    }

    private fun isGoogleHost(host: String): Boolean =
        host == "google.com" || host.endsWith(".google.com") ||
            host == "google.co.kr" || host.endsWith(".google.co.kr") ||
            host == "gstatic.com" || host.endsWith(".gstatic.com") ||
            host == "googleusercontent.com" || host.endsWith(".googleusercontent.com")

    private fun closeLens() {
        if (intent.getBooleanExtra(EXTRA_RESTORE_FLOATING_BUTTON, false)) moveTaskToBack(true)
        finish()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        intent.getStringExtra(EXTRA_TEMP_IMAGE_PATH)?.let { path ->
            runCatching {
                val sessions = java.io.File(filesDir, "sessions").canonicalFile
                val image = java.io.File(path).canonicalFile
                if (image.parentFile == sessions || image.parentFile?.parentFile == sessions) image.delete()
            }
        }
        if (intent.getBooleanExtra(EXTRA_RESTORE_FLOATING_BUTTON, false) && ScanSessionStore.state.value.captureActive) FloatingScanService.show(this)
        super.onDestroy()
    }

    companion object {
        const val EXTRA_IMAGE_URI = "cleantouch.lens.image_uri"
        const val EXTRA_IMAGE_MIME_TYPE = "cleantouch.lens.image_mime_type"
        const val EXTRA_TEMP_IMAGE_PATH = "cleantouch.lens.temp_image_path"
        const val EXTRA_RESTORE_FLOATING_BUTTON = "cleantouch.lens.restore_floating_button"
    }
}
