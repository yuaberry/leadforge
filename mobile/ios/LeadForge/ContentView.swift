import SwiftUI
import WebKit

// MARK: - Main App

@main
struct LeadForgeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

// MARK: - Content View

struct ContentView: View {
    @AppStorage("serverUrl") private var serverUrl = ""
    @State private var showSetup = false

    var body: some View {
        NavigationView {
            if serverUrl.isEmpty {
                SetupView()
            } else {
                WebView(url: URL(string: serverUrl)!)
                    .ignoresSafeArea()
                    .navigationTitle("LeadForge")
                    .navigationBarTitleDisplayMode(.inline)
            }
        }
    }
}

// MARK: - Setup View

struct SetupView: View {
    @AppStorage("serverUrl") private var serverUrl = ""
    @State private var url = ""
    @State private var showError = false

    var body: some View {
        VStack(spacing: 24) {
            Image(systemName: "flame.fill")
                .font(.system(size: 64))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.blue, .purple, .cyan],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .padding(.bottom, 8)

            Text("LeadForge")
                .font(.largeTitle.bold())

            Text("Encontre. Qualifique. Personalize. Converta.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            TextField("https://seu-servidor.com.br", text: $url)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.URL)
                .autocapitalization(.none)
                .autocorrectionDisabled()
                .padding(.horizontal, 32)

            if showError {
                Text("Digite uma URL válida")
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            Button("Conectar") {
                let trimmed = url.trimmingCharacters(in: .whitespaces)
                if trimmed.hasPrefix("http") {
                    serverUrl = trimmed
                } else {
                    showError = true
                }
            }
            .buttonStyle(.borderedProminent)

            Spacer()
        }
        .padding(.top, 80)
    }
}

// MARK: - Web View

struct WebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isInspectable = true
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator: NSObject, WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            // abre links externos no Safari
            if let url = navigationAction.request.url,
               let host = url.host(),
               let currentHost = webView.url?.host(),
               host != currentHost {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }
    }
}
