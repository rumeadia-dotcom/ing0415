/**
 * 한국어 사전 (i18n 진입점).
 * 마스터: docs/architecture/v1/frontend.md §14
 *
 * - 모든 사용자 노출 텍스트는 본 객체의 path 로 참조한다 (하드코딩 금지).
 * - `t()` 헬퍼는 Stage 후속에서 도입. 본 Stage 는 객체 path 직접 접근.
 * - 1000줄 초과 시 도메인별 분할 (`src/locales/ko/<domain>.ts`).
 */

export const ko = {
  app: {
    name: 'MarketCast',
  },
  nav: {
    main: '메인',
    aux: '보조',
    dashboard: '대시보드',
    register: '상품 등록',
    markets: '마켓 계정',
    history: '등록 이력',
    settings: '설정',
    help: '도움말',
  },
  status: {
    pending: '대기',
    running: '진행 중',
    partial: '일부 성공',
    succeeded: '성공',
    failed: '실패',
    retrying: '재시도',
    cancelled: '취소',
  },
  market: {
    naver: '네이버 스마트스토어',
    coupang: '쿠팡',
    '11st': '11번가',
    gmarket: 'G마켓',
    auction: '옥션',
  },
  marketStatus: {
    ready: '연결 가능',
    coming_soon: '오픈 준비중',
  },
  auth: {
    login: {
      title: '로그인',
      subtitle: '다중 마켓 상품 자동 등록 SaaS',
      tabEmail: '이메일 로그인',
      tabSocial: '소셜 로그인',
      email: '이메일',
      emailPlaceholder: 'you@example.com',
      password: '비밀번호',
      passwordPlaceholder: '비밀번호를 입력해주세요',
      passwordShow: '비밀번호 표시',
      passwordHide: '비밀번호 숨김',
      submit: '로그인',
      submitting: '로그인 중…',
      forgot: '비밀번호를 잊으셨나요?',
      signup: '회원가입',
      socialNotice: '소셜 로그인은 다음 업데이트에서 제공됩니다.',
    },
    signup: {
      title: '회원가입',
      subtitle: '셀러 계정을 만들고 5분 안에 5개 마켓에 등록하세요',
      displayName: '표시 이름',
      displayNamePlaceholder: '예: 홍길동 스토어',
      passwordHint: '10자 이상 · 영문 대소문자 / 숫자 / 특수문자 중 3종 이상',
      passwordConfirm: '비밀번호 확인',
      termsRequired: '이용약관 및 개인정보처리방침 동의 (필수)',
      marketingOptional: '마케팅 정보 수신 동의 (선택)',
      submit: '가입하기',
      submitting: '가입 중…',
      successTitle: '이메일 인증을 완료해주세요',
      successBody:
        '{email} 로 인증 메일을 발송했습니다. 메일함을 확인하고 링크를 클릭해주세요.',
      backToLogin: '로그인으로 돌아가기',
    },
    forgot: {
      title: '비밀번호 재설정',
      subtitle: '가입한 이메일로 재설정 링크를 보내드립니다',
      submit: '재설정 메일 보내기',
      submitting: '발송 중…',
      successTitle: '재설정 메일을 발송했습니다',
      successBody:
        '입력하신 이메일이 등록되어 있다면 잠시 후 메일이 도착합니다. 메일함과 스팸함을 확인해주세요.',
      backToLogin: '로그인으로 돌아가기',
    },
    reset: {
      title: '새 비밀번호 설정',
      subtitle: '재설정 링크로 진입한 화면입니다. 새 비밀번호를 입력해주세요.',
      newPassword: '새 비밀번호',
      passwordConfirm: '새 비밀번호 확인',
      submit: '비밀번호 변경',
      submitting: '변경 중…',
      successToast: '비밀번호가 변경되었습니다. 다시 로그인해주세요.',
      invalidSession: '재설정 링크가 만료되었거나 유효하지 않습니다.',
      requestAgain: '다시 요청하기',
    },
    strength: {
      label: '비밀번호 강도',
    },
    common: {
      noAccount: '계정이 없으신가요?',
      hasAccount: '이미 계정이 있으신가요?',
    },
  },
} as const

export type Locale = typeof ko
