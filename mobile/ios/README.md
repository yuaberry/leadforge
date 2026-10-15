// LeadForge iOS — Xcode Project
//
// Como compilar:
// 1. Abra o Xcode no macOS
// 2. File → New → Project → iOS App
// 3. Configure:
//    - Product Name: LeadForge
//    - Team: sua equipe Apple Developer
//    - Bundle Identifier: com.yuadevs.leadforge
// 4. Substitua os arquivos gerados pelos deste diretório:
//    - ContentView.swift
//    - Info.plist
// 5. Build (Cmd+B) e Run (Cmd+R) no simulator ou device
//
// Requisitos:
// - macOS com Xcode 15+
// - Apple Developer Account ($99/ano) para publicar na App Store
// - iPhone iOS 16+

// O app é um WebView nativo (SwiftUI + WKWebView) que:
// - Na primeira execução: pede a URL do servidor LeadForge
// - Salva a URL em AppStorage (UserDefaults)
// - Abre o LeadForge numa WebView nativa com gestos de voltar/avançar
// - Links externos abrem no Safari
// - Navegação persiste entre sessões
