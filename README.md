# Qwen3 TTS Studio Web

Qwen3 TTS Studio의 웹 프론트엔드입니다. Vue 3와 Vite를 기반으로 개발되었으며, 사용자가 쉽고 직관적으로 음성을 합성하고 목소리를 복제할 수 있는 인터페이스를 제공합니다.

## 기술 스택 (Tech Stack)

- **Framework**: [Vue 3](https://vuejs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: TypeScript
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Routing**: [Vue Router](https://router.vuejs.org/)
- **HTTP Client**: Axios
- **Icons**: Lucide Vue Next

## 기능 (Features)

- **텍스트 음성 변환 (TTS) UI**: 텍스트를 입력하고 다양한 음성으로 변환 요청을 보낼 수 있습니다.
- **오디오 재생**: 생성된 오디오를 웹 브라우저에서 바로 재생합니다.
- **목소리 복제 인터페이스**: 사용자의 목소리를 녹음하거나 파일을 업로드하여 새로운 음성 프로필을 생성합니다.
- **음성 관리**: 사용 가능한 음성 목록을 확인하고 관리합니다.

## 설치 및 실행 (Installation & Running)

### 1. 의존성 설치 (Install Dependencies)

```bash
npm install
```

### 2. 개발 서버 실행 (Run Development Server)

```bash
npm run dev
```

기본적으로 `http://localhost:5173` (또는 Vite가 할당한 포트)에서 실행됩니다.

### 3. 빌드 (Build)

배포를 위한 정적 파일을 생성합니다.

```bash
npm run build
```

빌드 결과물은 `dist` 디렉토리에 생성됩니다.

## 폴더 구조 (Folder Structure)

```
src/
├── app/               # 메인 앱 컴포넌트 및 엔트리 포인트 
├── assets/            # 정적 리소스 (이미지, 스타일 등)
├── components/        # 재사용 가능한 Vue 컴포넌트
├── router/            # 라우팅 설정
├── stores/            # Pinia 스토어 (상태 관리)
├── views/             # 페이지 단위 컴포넌트
└── main.ts            # 애플리케이션 진입점
```

## API 연동

이 웹 애플리케이션은 `qwen3-tts-studio-api` 백엔드 서비스와 통신합니다. 개발 환경에서는 Vite 설정(`vite.config.ts`)을 통해 API 요청이 프록시될 수 있습니다. (기본 API 주소: `http://localhost:8000`)
