using System;
using System.IO;
using System.IO.Pipes;
using System.Security.Cryptography;
using System.Text;
class VideoTimeHost {
  static byte[] ReadExact(Stream stream, int count) {
    var result = new byte[count]; int position = 0;
    while (position < count) { int read = stream.Read(result, position, count - position); if (read == 0) throw new EndOfStreamException(); position += read; }
    return result;
  }
  static void Main() {
    try {
      string hash;
      using (var sha = SHA256.Create()) { hash = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(Environment.UserName))).Replace("-", "").ToLowerInvariant().Substring(0, 16); }
      using (var pipe = new NamedPipeClientStream(".", "cleantouch.timeline." + hash, PipeDirection.InOut)) {
        pipe.Connect(1500);
        using (var input = Console.OpenStandardInput()) using (var output = Console.OpenStandardOutput()) {
          while (true) {
            var header = ReadExact(input, 4); int length = BitConverter.ToInt32(header, 0);
            if (length < 2 || length > 8192) return;
            var payload = ReadExact(input, length);
            pipe.Write(header, 0, 4); pipe.Write(payload, 0, payload.Length); pipe.Flush();
            var responseHeader = ReadExact(pipe, 4); int responseLength = BitConverter.ToInt32(responseHeader, 0);
            if (responseLength < 2 || responseLength > 8192) return;
            var response = ReadExact(pipe, responseLength);
            output.Write(responseHeader, 0, 4); output.Write(response, 0, response.Length); output.Flush();
          }
        }
      }
    } catch { /* Native messaging disconnection is retried by the extension. */ }
  }
}
