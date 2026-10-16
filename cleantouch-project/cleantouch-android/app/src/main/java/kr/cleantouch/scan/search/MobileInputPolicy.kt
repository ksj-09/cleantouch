package kr.cleantouch.scan.search

import java.net.URI
import java.net.URLEncoder

object MobileInputPolicy {
    private val unsafe=Regex("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u202a-\\u202e\\u2066-\\u2069]")
    fun question(value:String)=value.normalize().replace(unsafe,"").replace("\r\n","\n").replace('\r','\n').trim().take(1500)
    fun query(value:String)=question(value).replace(Regex("https?://\\S+",RegexOption.IGNORE_CASE)," ")
        .replace(Regex("(?:시스템|개발자|이전|위)\\s*(?:지시|명령).{0,60}(?:무시|따라|공개)")," ")
        .replace(Regex("[{}<>`$|\\\\]")," ").replace(Regex("\\s+")," ").trim().take(60)
    fun shopping(query:String):List<ChatLink> {
        val q=query(query);if(q.isBlank())return emptyList();val e=URLEncoder.encode(q,"UTF-8").replace("+","%20")
        return listOf(
            ChatLink("네이버쇼핑에서 비교","https://search.shopping.naver.com/search/all?query=$e"),
            ChatLink("쿠팡에서 비교","https://www.coupang.com/np/search?q=$e"),
            ChatLink("11번가에서 비교","https://search.11st.co.kr/Search.tmall?kwd=$e"),
            ChatLink("G마켓에서 비교","https://browse.gmarket.co.kr/search?keyword=$e"),
            ChatLink("Google 쇼핑에서 비교","https://www.google.com/search?tbm=shop&q=$e"),
        )
    }
    fun safeUrl(value:String):String {
        return runCatching {
            val uri=URI(value);val host=uri.host.orEmpty().lowercase()
            require(uri.scheme=="https"&&host.contains('.')&&uri.userInfo==null)
            require(!Regex("^(localhost|127\\.|0\\.|10\\.|192\\.168\\.|169\\.254\\.|172\\.(1[6-9]|2\\d|3[01])\\.)").containsMatchIn(host))
            uri.toString()
        }.getOrDefault("")
    }
}

private fun String.normalize()=java.text.Normalizer.normalize(this,java.text.Normalizer.Form.NFKC)
