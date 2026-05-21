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
    sales: '판매',
    env: '환경',
    dashboard: '대시보드',
    register: '상품 등록',
    markets: '마켓 계정',
    history: '등록 이력',
    orders: '주문 현황',
    settings: '설정',
    help: '도움말',
    shipping: {
      group: '배송',
      orders: '주문 현황',
      print: '운송장 출력',
      dispatch: '송장 일괄 제출',
      history: '배송 이력',
      settings: '배송 설정',
    },
  },
  shell: {
    brandTagline: '한 번의 등록, 모든 마켓',
    openMenu: '메뉴 열기',
    primaryNavLabel: '주요 메뉴',
    sellerPlaceholderName: 'konai 셀러',
    sellerPlaceholderEmail: 'seller@konai.com',
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
  markets: {
    page: {
      title: '마켓 계정',
      subtitleLine1: '연결된 마켓을 관리하고 새 마켓을 연결합니다',
      newConnect: '+ 새 연결',
      live: '실시간 동기화 켜짐',
      sectionConnected: '연결된 계정',
    },
    summary: {
      connectedHeading: '연결된 마켓',
      activeOf: (n: number, total: number) => `${n} / ${total}`,
      countersAria: '마켓 연결 요약',
      activeCount: (n: number) => `${n}개 활성`,
      expiringCount: (n: number) => `${n}개 갱신 필요`,
      errorCount: (n: number) => `${n}개 인증 실패`,
      comingSoonCount: (n: number) => `${n}개 v2 예정`,
    },
    table: {
      colMarket: '마켓 · 인증 방식',
      colAccount: '계정',
      colExpiry: '토큰 만료',
      colStatus: '상태',
      colActions: '액션',
      verifiedAt: (rel: string) => `마지막 검증 ${rel}`,
      verifyPending: '검증 전',
      autoRefresh: '자동 갱신',
      manualRefresh: '수동 갱신',
      comingSoonNote: 'v2 예정',
      noAccount: '—',
    },
    status: {
      active: '연결됨',
      expiring: '만료 임박',
      expired: '재인증 필요',
      revoked: '해제됨',
      error: '인증 실패',
      coming_soon: '준비 중',
    },
    actions: {
      manage: '관리',
      reverify: '상태 확인',
      reverifying: '확인 중…',
      reauth: '재인증',
      reconnect: '재연결',
      disconnect: '연결 해제',
      disconnecting: '해제 중…',
      cancel: '취소',
      alreadyRevoked: '이미 해제된 계정입니다',
    },
    banners: {
      noActiveTitle: '연결된 활성 마켓이 없습니다',
      noActiveBody: '상품 등록 전에 1개 이상의 마켓을 다시 연결하세요.',
      expiringTitle: (label: string, days: number) =>
        `${label} 토큰이 ${days}일 후 만료돼요`,
      expiringBody: '자동 갱신되지 않는 인증 방식이라 재인증이 필요해요.',
      expiringCta: '지금 재인증',
    },
    empty: {
      title: '아직 연결된 마켓이 없습니다.',
      body: '상품을 등록하려면 먼저 1개 이상의 마켓 계정을 연결하세요.',
      cta: '+ 첫 마켓 연결하기',
      hint: 'v1 정식 = 네이버 / 쿠팡 / G마켓 / 옥션 4종 · 11번가는 오픈 준비중',
    },
    connect: {
      pageTitle: '마켓 연결',
      pageSubtitle:
        '연결할 마켓을 선택하세요. v1 정식 = 네이버 / 쿠팡 / G마켓 / 옥션. 11번가는 오픈 준비중.',
      breadcrumb: {
        markets: '마켓 계정',
        new: '신규 연결',
      },
      authHint: {
        oauth: 'OAuth 2.0 · 마켓 로그인 페이지로 이동',
        hmac: 'HMAC · Access / Secret / Vendor ID 입력',
        esm_jwt: 'ESM JWT · Master / Secret / Seller ID 입력',
        disabled: 'v2 예정 · IP 화이트리스트 해소 후 진입',
      },
      cardCta: '연결 시작 →',
      cardCtaDisabled: 'v2 예정',
      backToList: '마켓 목록으로',
      backToSelect: '마켓 선택으로',
      cancel: '취소',
    },
    form: {
      sectionHeading: (label: string) => `${label} 계정 연결`,
      sectionHint: {
        oauth: 'OAuth 2.0 방식 · 마켓 로그인 페이지에서 동의',
        hmac: 'HMAC 방식 · Wing 셀러 콘솔에서 발급',
        esm_jwt: 'ESM JWT 방식 · ESM Plus 콘솔에서 발급',
        disabled: '현재 오픈 준비중입니다',
      },
      issuanceGuide: '발급 가이드 ↗',
      labelOptional: '계정 라벨 (구분용)',
      labelHint: '1~40자 · 동일 마켓에서 라벨 중복 불가',
      labelPlaceholder: '예: 메인 스토어',
      required: '필수',
      submit: {
        oauth: (label: string) => `${label} 로그인으로 이동 →`,
        oauthPending: '이동 중…',
        save: '연결',
        savePending: '연결 중…',
      },
      hmac: {
        vendorId: '벤더 ID (Vendor ID)',
        vendorIdHint: '예: A로 시작하는 9자리 코드',
        vendorIdPlaceholder: '예: A00012345',
        accessKey: '액세스 키 (Access Key)',
        accessKeyPlaceholder: '예: aaaa-bbbb-cccc-dddd',
        secretKey: '시크릿 키 (Secret Key)',
        secretKeyPlaceholder: '40자 이상의 영문 + 숫자',
        guideTitle: '키 발급 절차 — 쿠팡 Wing',
        guideSteps: [
          '쿠팡 Wing 셀러 콘솔에 로그인',
          '관리 › 인증정보 관리 메뉴 진입',
          '액세스/시크릿 키 신규 발급',
          '벤더 ID 는 상단 프로필에서 확인',
        ] as const,
      },
      esm: {
        masterId: 'Master ID',
        masterIdPlaceholder: 'ESM 통합 마스터 ID',
        secretKey: 'Secret Key',
        secretKeyPlaceholder: 'ESM 발급 시크릿',
        sellerId: 'Seller ID',
        sellerIdPlaceholder: (label: string) => `${label} 셀러 ID`,
        siteNote: (site: 'G' | 'A', label: string) =>
          `site 코드는 자동으로 ${site} (${label}) 으로 설정됩니다.`,
        guideTitle: '키 발급 절차 — ESM Plus',
        guideSteps: [
          'ESM Plus 콘솔 로그인',
          '판매자 도구 › API 관리 메뉴 진입',
          'API 키 발급 후 Master/Secret 복사',
          'Seller ID 는 상점 정보에서 확인',
        ] as const,
      },
      reveal: {
        show: '표시',
        hide: '숨김',
      },
      securityNote:
        '입력값은 pgcrypto 로 암호화되어 저장돼요. 화면에 다시 노출되지 않아요.',
      securityWarn:
        '시크릿 키는 절대 외부에 공유하지 마세요. 분실 시 발급처에서 재발급해야 해요.',
      disabled: {
        title: (label: string) => `${label} — 오픈 준비중`,
        body: 'IP 화이트리스트 정책 해결 후 v2 단계에서 진입합니다. 현재는 네이버 · 쿠팡 · G마켓 · 옥션 4개 마켓만 연결할 수 있습니다.',
      },
    },
    callback: {
      headerNote: '마켓 계정 연결 · OAuth 콜백',
      loadingTitle: '연결 처리 중…',
      loadingBody: (label: string) =>
        `${label} 토큰을 안전하게 저장하고 계정 정보를 확인하는 중입니다.`,
      loadingProgress: '진행 중',
      successTitle: (label: string) => `${label} 연결 완료`,
      successBody: (account: string) =>
        `계정 ${account} 가 정상 연결됐어요. OAuth 토큰은 만료 전에 자동으로 갱신돼요.`,
      successAutoRedirect: '3초 후 자동 이동돼요',
      successCta: '마켓 계정 목록으로 →',
      meta: {
        method: '방식',
        expiry: '만료',
        scope: '스코프',
      },
      failedTitle: '연결에 실패했습니다',
      failedSubtitle: (label: string) => `${label} 인증을 완료하지 못했습니다`,
      retry: '처음부터 다시 시도',
      backToList: '마켓 목록으로',
    },
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
      checkingSession: '세션을 확인하는 중…',
    },
    strength: {
      label: '비밀번호 강도',
    },
    common: {
      noAccount: '계정이 없으신가요?',
      hasAccount: '이미 계정이 있으신가요?',
    },
  },
  orders: {
    dashboard: {
      title: '주문 현황',
      subtitle: '오늘 발생한 주문과 배송 상태를 한눈에 확인하세요',
      newOrdersLabel: '신규 주문',
      logenRegisteredLabel: '로젠 등록 완료',
      waybillPendingLabel: '운송장 출력 대기',
      dispatchSubmittedLabel: '송장 제출 완료',
      newOrdersHint: '아직 로젠에 등록되지 않은 주문',
      logenRegisteredHint: '운송장 출력 가능 상태',
      waybillPendingHint: '출력 대기 중 주문',
      dispatchSubmittedHint: '마켓에 송장이 제출된 주문',
      actionPrint: '운송장 출력',
      actionDispatch: '송장 일괄 제출',
      goToList: '전체 주문 보기',
      byMarketHeading: '마켓별 신규 주문',
      empty: '오늘 신규 주문이 없습니다',
      emptyHint: '주문이 들어오면 이 화면에서 바로 확인할 수 있습니다',
      errorLoad: '주문 요약을 불러오지 못했습니다',
    },
    list: {
      title: '주문 목록',
      subtitle: '필터로 마켓·상태·기간을 좁혀 주문을 확인합니다',
      filterMarket: '마켓',
      filterStatus: '배송 상태',
      filterAll: '전체',
      filterFrom: '시작일',
      filterTo: '종료일',
      filterReset: '필터 초기화',
      searchPlaceholder: '상품명 · 주문번호 · 수취인 검색',
      tableProduct: '상품',
      tableMarket: '마켓',
      tableBuyer: '주문자',
      tableStatus: '배송 상태',
      tableWaybill: '운송장',
      tableOrderedAt: '주문일시',
      tableOrderId: '주문번호',
      tableProductBuyer: '상품 · 주문자',
      empty: '조건에 맞는 주문이 없습니다',
      emptyAbsolute: '아직 주문이 없습니다',
      emptyFilteredHint:
        '필터를 넓혀보세요. 마켓 / 상태 / 검색어를 조정하면 더 많은 주문이 표시됩니다.',
      emptyAbsoluteHint:
        '주문 동기화는 10분 주기로 자동 실행돼요. 들어오면 이 화면에서 바로 확인할 수 있습니다.',
      emptySyncHint:
        '팁: 주문 동기화는 10분 주기로 자동 실행됩니다. 최근 동기화 시각은 화면 상단에서 확인할 수 있어요.',
      errorLoad: '주문 목록을 불러오지 못했습니다',
      loading: '주문 목록 불러오는 중',
      totalCount: (n: number) => `총 ${n.toLocaleString()}건`,
    },
    detail: {
      title: '주문 상세',
      subtitleFallback: '주문 정보',
      backToList: '목록으로',
      sectionOrder: '주문 정보',
      sectionShipping: '배송 정보',
      sectionTimeline: '배송 진행 상태',
      sectionDispatch: '마켓 송장 제출',
      labelExternalOrderId: '주문번호',
      labelMarket: '마켓',
      labelProduct: '상품',
      labelOption: '옵션',
      labelQuantity: '수량',
      labelBuyer: '주문자',
      labelBuyerPhone: '연락처',
      labelAddress: '배송지',
      labelWaybill: '운송장번호',
      labelOrderedAt: '주문일시',
      labelDispatchStatus: '제출 상태',
      noWaybill: '아직 발급되지 않음',
      manualResolveCta: '운송장 수동 입력',
      manualResolveHint: '로젠 자동 등록이 실패한 주문은 직접 입력할 수 있습니다',
      failureBannerTitle: '로젠 자동 등록 3회 실패 — 수동 처리가 필요해요',
      failureBannerBody:
        '로젠 콜센터에서 운송장을 수기 발급받은 뒤, 운송장 번호를 입력하면 자동 흐름으로 복귀합니다.',
      timelinePending: '대기 중',
      dispatchHint: '운송장 발급 후 자동으로 마켓 송장 API에 제출됩니다.',
      errorLoad: '주문 상세를 불러오지 못했습니다',
      notFound: '주문을 찾을 수 없습니다',
    },
    timeline: {
      collected: '수집됨',
      logen_registered: '로젠 등록',
      logen_failed: '로젠 등록 실패',
      waybill_printed: '운송장 출력',
      tracking_submitted: '마켓 송장 제출',
    },
    dispatch: {
      pending: '제출 대기',
      submitted: '제출 완료',
      failed: '제출 실패',
    },
    manualResolve: {
      title: '운송장 수동 입력',
      description:
        '로젠 자동 등록이 실패한 주문에 대해 운송장번호를 직접 입력합니다. 입력 후 마켓 송장 제출 단계로 이어집니다.',
      waybillLabel: '운송장번호',
      waybillPlaceholder: '예) 123456789012',
      noteLabel: '메모 (선택)',
      notePlaceholder: '처리 사유 등',
      submit: '확인',
      submitting: '저장 중…',
      cancel: '취소',
      success: '운송장이 등록되었습니다',
      errorGeneric: '운송장 수동 입력에 실패했습니다. 잠시 후 다시 시도해주세요',
      onlyForFailed: '로젠 등록 실패 상태 주문에서만 사용할 수 있습니다',
    },
  },
  settings: {
    title: '설정',
    subtitle: '계정 정보와 환경 설정을 관리합니다',
    nav: {
      heading: '설정',
      account: '계정',
      shipping: '배송 설정',
      notifications: '알림',
      billing: '청구',
      team: '팀',
      developer: '개발자',
      v2Pill: 'v2',
      openMobileNav: '설정 메뉴 열기',
    },
    account: {
      title: '계정',
      description: '현재 로그인된 계정 정보',
      email: '이메일',
      signOut: '로그아웃',
      signOutSubmitting: '로그아웃 중…',
      signOutDescription: '현재 기기에서 로그아웃합니다. 다른 기기의 세션은 유지됩니다.',
      signOutConfirmTitle: '로그아웃하시겠어요?',
      signOutConfirmBody: '로그아웃하면 로그인 화면으로 이동합니다.',
      signOutCancel: '취소',
      signOutSuccess: '로그아웃되었습니다.',
      signOutError: '로그아웃 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
    },
    shipping: {
      title: '배송 설정',
      subtitle: '로젠택배 API 자격증명과 발송인 정보를 관리합니다.',
      logenCard: {
        title: '로젠택배 API 연동',
        connected: '연결됨',
        connectedDescription: 'userId / custCd 가 암호화 저장되어 있습니다.',
        disconnected: '미연결',
        disconnectedDescription:
          '로젠 B2B 계약 후 발급받은 userId(연동업체코드) / custCd(거래처코드) 를 입력하세요.',
        notVerified: '연결 테스트 미수행',
        lastVerifiedAt: '최근 연결 확인',
        lastErrorAt: '최근 오류',
        manageButton: '로젠 API 설정',
      },
      senderCard: {
        title: '발송인 정보',
        configured: '입력 완료',
        configuredDescription: '발송지·연락처·운임 설정이 완료되었습니다.',
        notConfigured: '입력 필요',
        notConfiguredDescription:
          '운송장 발급에는 발송인명·발송지 주소·연락처·운임 설정이 필요합니다.',
        manageButton: '발송인 정보 편집',
      },
      autoDispatchCard: {
        title: '출력 후 자동 제출',
        description:
          '운송장 출력을 완료하면 4개 마켓에 송장번호를 자동으로 제출합니다. OFF 면 [송장 일괄 제출] 을 직접 눌러야 합니다.',
        on: 'ON',
        off: 'OFF',
        toggleAriaLabel: '출력 후 자동 제출 토글',
        updateError: '설정을 변경하는 중 오류가 발생했습니다.',
      },
      carrierCard: {
        title: '기본 택배사',
        description: 'v2 는 로젠택배만 지원합니다. 다른 택배사는 차후 버전에 추가됩니다.',
        carrier: '로젠택배',
      },
      logenPage: {
        title: '로젠 API 연동',
        subtitle:
          'userId(연동업체코드) / custCd(거래처코드) 를 입력하여 로젠 B2B 자동 등록을 활성화합니다.',
        userIdLabel: 'userId (연동업체코드)',
        userIdPlaceholder: '예: LGN_12345',
        custCdLabel: 'custCd (거래처코드)',
        custCdPlaceholder: '예: CUST_67890',
        save: '저장',
        saving: '저장 중…',
        saveAndVerify: '저장 후 연결 테스트',
        verify: '연결 테스트',
        verifying: '연결 확인 중…',
        verifySuccess: '연결 확인이 완료되었습니다.',
        verifyDescription:
          '저장된 자격증명으로 로젠 API 에 토큰 발급 요청을 보내 동작 여부를 확인합니다.',
        backLink: '배송 설정으로',
        helperContract:
          '로젠택배 영업소를 통해 B2B 계약을 완료한 셀러만 사용 가능합니다.',
      },
      senderPage: {
        title: '발송인 정보',
        subtitle:
          '운송장에 인쇄될 발송인 정보와 로젠 운임 항목을 입력합니다. 계약 시 확정된 값을 사용하세요.',
        senderNameLabel: '발송인명',
        senderNamePlaceholder: '예: 홍길동 스토어',
        senderAddressLabel: '발송지 주소',
        senderAddressPlaceholder: '시·군·구를 포함한 전체 주소',
        senderPhoneLabel: '연락처',
        senderPhonePlaceholder: '예: 010-1234-5678',
        fareTyLabel: '운임 타입 (fareTy)',
        fareTyHelp:
          'C = 선불(계약) / S = 착불 / R = 신용. 일반적으로 B2B 계약은 C 를 사용합니다.',
        dlvFareLabel: '택배 운임 (dlvFare, 원)',
        dlvFarePlaceholder: '예: 2500',
        dlvFareHelp: '계약 시 확정된 단가를 입력하세요. 단위: 원.',
        save: '저장',
        saving: '저장 중…',
        savedToast: '발송인 정보가 저장되었습니다.',
        backLink: '배송 설정으로',
      },
      errors: {
        invalid_credentials: '입력한 자격증명이 유효하지 않습니다. 코드를 다시 확인해주세요.',
        contract_not_active:
          '로젠 B2B 계약이 활성 상태가 아닙니다. 영업소를 통해 계약 상태를 확인하세요.',
        rate_limited: '잠시 후 다시 시도해주세요. (로젠 API 요청 한도)',
        unauthenticated: '로그인이 만료되었습니다. 다시 로그인 후 시도해주세요.',
        validation_failed: '입력 형식이 올바르지 않습니다.',
        network_error: '네트워크 오류가 발생했습니다. 연결 상태를 확인해주세요.',
        internal: '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
      empty: {
        title: '아직 로젠 API 가 연결되지 않았습니다',
        body:
          '운송장 자동 발급을 사용하려면 로젠 자격증명을 등록해야 합니다. [로젠 API 설정] 을 눌러 시작하세요.',
      },
    },
  },
  shipping: {
    placeholder: '작업 진행 중입니다. 본 화면은 곧 활성화됩니다.',
    tabs: {
      ariaLabel: '배송 페이지 탭',
      print: '운송장 출력',
      dispatch: '송장 일괄 제출',
      history: '배송 이력',
    },
    print: {
      title: '운송장 출력',
      subtitle: '로젠 등록이 완료된 주문의 운송장을 1클릭으로 출력하세요',
      readyCount: '출력 대기 {count}건',
      empty: '출력 대기 중인 주문이 없습니다.',
      cta: {
        openPopup: '출력 팝업 열기',
        confirmDone: '출력 완료',
      },
      hint: '팝업이 차단되었나요? 브라우저 주소창의 팝업 차단 아이콘을 눌러 허용해주세요.',
      autoDispatchOn: '"출력 후 자동 제출" 설정이 켜져 있어 출력 완료 시 송장 제출이 자동 시작됩니다.',
      confirmSuccess: '출력 완료로 기록했습니다.',
    },
    dispatch: {
      title: '송장 일괄 제출',
      subtitle: '출력이 완료된 주문의 송장을 4개 마켓에 동시에 제출합니다',
      preview: {
        heading: '제출 미리보기',
        marketCount: '{market} {count}건',
        notPrintedWarning: '아직 출력하지 않은 주문이 포함되어 있어요. 진행은 가능하지만 운송장 미부착 위험을 확인해주세요.',
      },
      cta: {
        start: '제출 시작',
        starting: '제출 시작 중…',
        viewResult: '결과 보기',
        backToOrders: '주문 현황으로',
      },
      progress: {
        heading: '제출 진행 중',
        marketProgress: '{market}: {done} / {total}',
        eta: '예상 남은 시간 {seconds}초',
      },
      empty: '제출 대상 주문이 없습니다. 운송장 출력을 먼저 완료해주세요.',
    },
    result: {
      title: '송장 제출 결과',
      summary: {
        success: '성공 {count}건',
        failed: '실패 {count}건',
        partial: '일부 성공 — {success}/{total}',
        succeeded: '모두 성공 — 오늘 {count}건 배송 처리 완료',
        allFailed: '모두 실패 — 오류 메시지를 확인하고 재시도해주세요',
      },
      market: {
        success: '성공',
        failed: '실패',
        errorCode: '오류 코드',
        errorMessage: '오류 메시지',
        showDetails: '자세히 보기',
        hideDetails: '접기',
      },
      cta: {
        retry: '실패 건만 재시도',
        retrying: '재시도 시작 중…',
        backToOrders: '주문 현황으로',
      },
    },
    history: {
      title: '배송 이력',
      subtitle: '과거 송장 제출 잡을 조회합니다',
      columns: {
        createdAt: '제출일',
        orderCount: '총 건수',
        success: '성공',
        failed: '실패',
        status: '상태',
      },
      status: {
        pending: '대기',
        running: '진행 중',
        partial: '일부 성공',
        succeeded: '성공',
        failed: '실패',
      },
      empty: '아직 송장 제출 이력이 없습니다.',
    },
  },
  settingsShipping: {
    placeholder: '작업 진행 중입니다. 본 화면은 곧 활성화됩니다.',
    hub: {
      title: '배송 설정',
      subtitle: '로젠택배 API 연동과 발송인 정보를 관리합니다',
      logen: {
        title: '로젠택배 API',
        connected: '연결됨',
        disconnected: '미연결',
        verifyFailed: '연결 검증 실패',
        verifiedAt: '마지막 확인: {at}',
        manage: '관리',
      },
      sender: {
        title: '발송인 정보',
        edit: '편집',
        incompleteHint: '집하 등록에 필요한 정보를 모두 입력해주세요.',
      },
      behavior: {
        title: '동작 설정',
        autoDispatchAfterPrint: '출력 후 자동 제출',
        autoDispatchHint: '운송장 출력 완료 시 송장 제출이 자동으로 시작됩니다.',
        defaultCarrier: '기본 택배사',
        defaultCarrierComingSoon: '추가 예정',
      },
    },
    logen: {
      title: '로젠 API 연동',
      subtitle: '로젠택배 B2B 계약 시 발급받은 코드를 입력해주세요',
      userIdLabel: '연동업체코드 (userId)',
      userIdPlaceholder: '예: A12345',
      custCdLabel: '거래처코드 (custCd)',
      custCdPlaceholder: '예: 0001234',
      save: '저장',
      saving: '저장 중…',
      verify: '연결 테스트',
      verifying: '확인 중…',
      verifySuccess: '연결이 정상입니다.',
      errorMap: {
        invalid: '코드를 다시 확인해주세요. (연동업체코드 또는 거래처코드 오류)',
        contractMissing: 'B2B 계약 진행이 필요합니다. 로젠 영업 담당자에게 문의해주세요.',
        slipExhausted: '채번 가능한 운송장이 부족합니다. 로젠 담당자에게 문의해주세요.',
        transient: '일시적 오류입니다. 잠시 후 다시 시도해주세요.',
        unknown: '알 수 없는 오류가 발생했어요.',
      },
      backToHub: '배송 설정으로',
    },
    sender: {
      title: '발송인 정보',
      subtitle: '로젠 집하 등록 시 사용되는 발송인 정보입니다',
      nameLabel: '발송인명',
      addressLabel: '발송지 주소',
      phoneLabel: '연락처',
      fareTyLabel: '운임 타입',
      fareTyPlaceholder: '계약 시 확정된 값을 선택해주세요',
      dlvFareLabel: '택배운임 (원)',
      save: '저장',
      saving: '저장 중…',
      backToHub: '배송 설정으로',
    },
  },
  footer: {
    terms: '이용약관',
    privacy: '개인정보처리방침',
    manual: '매뉴얼',
    copyright: '© 2026 MarketCast',
    nav: '하단 푸터',
  },
  legal: {
    common: {
      tocHeading: '목차',
      tocMobileToggle: '목차 펼치기',
      skipToContent: '본문으로 건너뛰기',
      lastUpdated: '최종 개정일: 2026년 5월 20일',
      effectiveFrom: '시행일: 2026년 6월 1일',
      draftNotice:
        '본 문서는 v1 출시 사전 검토용 초안입니다. 법률 검토를 거쳐 운영 전 최종본으로 교체됩니다.',
    },
    terms: {
      title: '이용약관',
      subtitle: 'MarketCast 서비스 이용에 관한 권리·의무 및 책임을 규정합니다.',
      sections: {
        purpose: {
          title: '제1조 (목적)',
          body:
            '본 약관은 MarketCast(이하 "회사")가 제공하는 다중 마켓 상품 자동 등록 SaaS(이하 "서비스")의 이용과 관련하여 회사와 회원 사이의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.',
        },
        definitions: {
          title: '제2조 (정의)',
          body:
            '본 약관에서 사용하는 용어의 정의는 다음과 같습니다.\n\n1. "서비스"란 회원이 입력한 상품 정보를 네이버 스마트스토어, 쿠팡, G마켓, 옥션 등 외부 마켓플레이스(이하 "마켓")에 일괄 등록할 수 있도록 제공하는 일체의 기능을 말합니다.\n2. "회원"이란 본 약관에 동의하고 회사가 정한 절차에 따라 서비스 이용계약을 체결한 자를 말합니다.\n3. "마켓 계정"이란 회원이 외부 마켓에서 보유한 판매자 계정 및 회사가 위임받아 보관하는 OAuth 토큰·API 자격증명을 말합니다.\n4. "등록 잡(RegistrationJob)"이란 회원이 요청한 다중 마켓 동시 등록 작업의 단위를 말합니다.',
        },
        effect: {
          title: '제3조 (약관의 효력 및 변경)',
          body:
            '① 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.\n② 회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용일자와 사유를 명시하여 시행일 7일 전(회원에게 불리한 변경인 경우 30일 전)부터 공지합니다.\n③ 회원이 개정약관에 동의하지 않을 경우 이용계약을 해지할 수 있으며, 시행일 이후에도 서비스를 계속 이용하는 경우 개정약관에 동의한 것으로 봅니다.',
        },
        service: {
          title: '제4조 (서비스 제공)',
          body:
            '① 회사는 다음 각 호의 서비스를 제공합니다.\n  1. 상품 정보 입력 및 다중 마켓 일괄 등록\n  2. 마켓별 카테고리 매핑 및 이미지 변환\n  3. 등록 결과 모니터링 및 재시도\n  4. 등록 이력 조회 및 통계\n  5. 기타 회사가 추가 개발하거나 제휴를 통해 회원에게 제공하는 일체의 서비스\n② 서비스는 연중무휴 24시간 제공함을 원칙으로 하되, 정기 점검·시스템 장애·외부 마켓 API 장애 등 부득이한 경우 일시 중단될 수 있습니다.\n③ 외부 마켓 API 의 정책 변경·장애·점검으로 인해 일부 기능이 제한될 수 있으며, 이로 인한 등록 실패는 회원에게 사전 또는 사후 통지합니다.',
        },
        signup: {
          title: '제5조 (회원가입)',
          body:
            '① 회원가입은 이용신청자가 본 약관 및 개인정보처리방침에 동의하고, 회사가 정한 양식에 따라 회원정보를 입력한 후 회사가 이를 승낙함으로써 성립합니다.\n② 회사는 다음 각 호에 해당하는 경우 회원가입을 거부하거나 사후에 이용계약을 해지할 수 있습니다.\n  1. 가입신청서의 내용을 허위로 기재한 경우\n  2. 타인의 명의를 도용한 경우\n  3. 부정한 용도로 서비스를 이용하고자 하는 경우\n  4. 만 14세 미만인 경우\n③ 회원은 가입정보에 변경이 있을 경우 지체 없이 이를 회사에 알리고 수정하여야 합니다.',
        },
        obligations: {
          title: '제6조 (회원의 의무)',
          body:
            '① 회원은 다음 행위를 하여서는 안 됩니다.\n  1. 타인의 정보를 도용하거나 허위 정보를 등록하는 행위\n  2. 회사가 게시한 정보를 무단으로 변경·복제·유포하는 행위\n  3. 서비스를 이용하여 법령 또는 공서양속에 반하는 행위\n  4. 서비스의 안정적 운영을 방해하는 행위(과도한 자동화 요청 등)\n  5. 등록 상품이 외부 마켓의 판매정책·약관에 위반되어 발생하는 일체의 결과에 대한 책임 회피\n② 회원은 자신의 마켓 자격증명과 비밀번호의 관리책임을 부담하며, 이를 제3자에게 양도·대여할 수 없습니다.',
        },
        change: {
          title: '제7조 (서비스의 변경 및 중단)',
          body:
            '① 회사는 운영상·기술상의 필요에 따라 서비스의 전부 또는 일부를 변경할 수 있으며, 변경 사유·내용·일자를 사전에 공지합니다.\n② 회사는 다음 각 호의 경우 서비스 제공을 일시 또는 영구히 중단할 수 있습니다.\n  1. 시스템 점검·증설·교체 등 운영상 필요한 경우\n  2. 천재지변, 국가 비상사태, 정전, 통신망 장애 등 불가항력적 사유가 발생한 경우\n  3. 외부 마켓 API 정책으로 서비스 제공이 불가능한 경우\n③ 서비스가 중단되는 경우 회사는 회원에게 가능한 한 사전에 통지하며, 사전 통지가 불가능한 경우에는 사후에 통지합니다.',
        },
        information: {
          title: '제8조 (정보의 제공 및 광고)',
          body:
            '① 회사는 서비스 운영에 필요한 공지사항, 이용 안내, 보안 경고 등의 정보를 회원에게 이메일·서비스 내 알림 등의 방법으로 제공할 수 있습니다.\n② 회사는 회원이 마케팅 수신에 동의한 경우에 한하여 상품 안내·이벤트·프로모션 정보를 제공할 수 있으며, 회원은 언제든지 수신 동의를 철회할 수 있습니다.\n③ 회사는 외부 마켓 API 의 정책 변경, 토큰 만료, 등록 실패 등 회원의 즉각적인 조치가 필요한 사항을 우선적으로 안내합니다.',
        },
        disclaimer: {
          title: '제9조 (면책조항)',
          body:
            '① 회사는 외부 마켓 API 의 변경·장애·정책 변경으로 인한 등록 실패, 지연, 데이터 손실에 대하여 회사의 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.\n② 회사는 회원이 입력한 상품 정보의 정확성, 적법성, 외부 마켓 정책 부합 여부에 대하여 보증하지 않으며, 등록 결과로 발생한 분쟁의 책임은 회원에게 있습니다.\n③ 회사는 무료로 제공되는 서비스의 이용과 관련하여 관련 법령에 특별한 규정이 없는 한 책임을 지지 않습니다.',
        },
        dispute: {
          title: '제10조 (분쟁 해결)',
          body:
            '① 회사와 회원 간 발생한 분쟁은 상호 협의에 의해 해결함을 원칙으로 합니다.\n② 협의로 해결되지 않을 경우, 「전자상거래 등에서의 소비자보호에 관한 법률」, 「콘텐츠산업 진흥법」 등 관련 법령 및 한국소비자원·전자거래분쟁조정위원회 등 분쟁조정기관의 조정에 따를 수 있습니다.',
        },
        governing: {
          title: '제11조 (준거법 및 관할)',
          body:
            '① 본 약관 및 서비스 이용과 관련하여 회사와 회원 간에 발생한 분쟁에 대하여는 대한민국 법령을 적용합니다.\n② 분쟁에 관한 소송은 민사소송법상 관할법원을 제1심 관할법원으로 합니다.',
        },
        addendum: {
          title: '제12조 (부칙)',
          body:
            '본 약관은 2026년 6월 1일부터 시행합니다. 본 약관의 시행 이전에 가입한 회원에게도 본 약관이 적용되며, 회원은 변경에 대한 동의를 거부할 권리가 있습니다.',
        },
      },
    },
    privacy: {
      title: '개인정보처리방침',
      subtitle:
        'MarketCast 는 정보주체의 자유와 권리 보호를 위해 「개인정보 보호법」 및 관계 법령에 따라 다음과 같이 개인정보를 처리합니다.',
      sections: {
        items: {
          title: '제1조 (수집하는 개인정보 항목)',
          body:
            '회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.\n\n[필수 항목]\n  • 회원가입: 이메일 주소, 비밀번호(단방향 해시), 표시 이름\n  • 마켓 계정 연결: 외부 마켓 OAuth Access Token / Refresh Token, API Key·Secret, Vendor ID, ESM Master ID 등 마켓별 자격증명(pgcrypto 컬럼 암호화 저장)\n  • 상품 등록: 셀러가 입력한 상품 정보, 이미지, 배송 정책\n\n[선택 항목]\n  • 사업자 정보: 사업자등록번호, 통신판매업 신고번호(마켓 정책상 필요한 경우)\n  • 연락처: 휴대전화번호(긴급 안내 수신용)\n\n[자동 수집]\n  • 접속 로그, IP 주소, 쿠키, 브라우저 정보, 서비스 이용 기록, Sentry 오류 리포트(PII 마스킹 후 적재)',
        },
        method: {
          title: '제2조 (개인정보 수집 방법)',
          body:
            '회사는 다음의 방법으로 개인정보를 수집합니다.\n  1. 홈페이지 회원가입, 서비스 이용 과정에서 회원이 직접 입력\n  2. 외부 마켓 OAuth 인증 시 마켓이 회사에 발급하는 액세스 토큰\n  3. 서비스 이용 과정에서 자동으로 생성되는 정보(로그, 쿠키, Sentry 이벤트)',
        },
        purpose: {
          title: '제3조 (개인정보의 이용 목적)',
          body:
            '회사는 수집한 개인정보를 다음 목적으로 이용합니다.\n  1. 회원 식별 및 본인 확인, 서비스 부정이용 방지\n  2. 다중 마켓 상품 등록 기능 제공(외부 마켓 API 호출)\n  3. 등록 결과 통지, 토큰 만료·재인증 안내 등 서비스 운영 관련 통지\n  4. 신규 기능 안내(마케팅 동의자에 한함)\n  5. 서비스 개선을 위한 통계 분석(개인 식별이 불가능한 형태로 가공)\n  6. 법령·약관 위반 행위에 대한 대응',
        },
        retention: {
          title: '제4조 (개인정보의 보유 및 이용기간)',
          body:
            '① 회사는 회원의 개인정보를 수집 목적이 달성될 때까지 보유·이용합니다. 회원이 탈퇴를 요청한 경우 지체 없이 파기합니다.\n② 다만 관계 법령에 따라 보존이 필요한 경우 다음 기간 동안 보존합니다.\n  • 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)\n  • 대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)\n  • 소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)\n  • 접속 로그: 3개월 (통신비밀보호법)\n③ 마켓 OAuth Refresh Token 은 회원이 마켓 연결을 해제하는 즉시 파기합니다.',
        },
        thirdParty: {
          title: '제5조 (개인정보의 제3자 제공)',
          body:
            '① 회사는 회원의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.\n② 다만 다음의 경우는 예외로 합니다.\n  • 회원이 마켓 등록 기능을 사용함에 따라 회원 본인이 입력한 상품 정보를 외부 마켓(네이버 스마트스토어, 쿠팡, G마켓, 옥션)에 전송하는 경우. 이는 회원 본인의 명시적 요청에 의한 API 호출이며, 별도의 동의 없이 즉시 처리됩니다.\n  • 법령에 의하여 수사기관·법원 등이 요청하는 경우',
        },
        delegation: {
          title: '제6조 (개인정보 처리 위탁)',
          body:
            '회사는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다.\n\n  • Supabase, Inc. (Postgres, Auth, Storage, Edge Functions, Realtime) — 데이터 저장·인증·파일 호스팅·서버리스 컴퓨팅. 위탁 기간: 회원 탈퇴 시 또는 위탁 계약 종료 시까지.\n  • Functional Software, Inc. (Sentry) — 운영 환경 오류 추적·성능 모니터링. PII(이메일·전화번호·토큰)는 SDK `beforeSend` 훅에서 마스킹 후 송신됩니다. 위탁 기간: 위탁 계약 종료 시까지.\n  • GitHub, Inc. (GitHub Pages) — 정적 프론트엔드 호스팅. 회원 정보 직접 처리 없음.\n\n회사는 위탁 계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁업무의 목적, 위탁업무의 내용, 위탁 기간 등을 명시하고, 수탁자가 개인정보를 안전하게 처리하는지 감독합니다.',
        },
        destruction: {
          title: '제7조 (개인정보의 파기 절차 및 방법)',
          body:
            '① 회사는 개인정보 보유기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 개인정보를 파기합니다.\n② 파기 방법은 다음과 같습니다.\n  • 전자적 파일 형태: 복구·재생할 수 없는 기술적 방법으로 영구 삭제\n  • 종이 문서: 분쇄기로 분쇄하거나 소각\n③ 회원 탈퇴 시 마켓 자격증명(OAuth 토큰·API Key)은 즉시 데이터베이스에서 삭제됩니다.',
        },
        rights: {
          title: '제8조 (정보주체의 권리·의무 및 행사 방법)',
          body:
            '① 회원은 회사에 대하여 언제든지 다음 각 호의 권리를 행사할 수 있습니다.\n  1. 개인정보 열람 요구\n  2. 오류 등이 있을 경우 정정 요구\n  3. 삭제 요구\n  4. 처리정지 요구\n② 위 권리 행사는 서비스 내 설정 화면 또는 개인정보 보호책임자에게 서면, 이메일로 요청할 수 있으며, 회사는 지체 없이 조치하겠습니다.\n③ 회원이 개인정보의 오류 등에 대한 정정을 요청한 경우 회사는 정정·삭제를 완료할 때까지 해당 개인정보를 이용·제공하지 않습니다.',
        },
        safety: {
          title: '제9조 (개인정보의 안전성 확보 조치)',
          body:
            '회사는 개인정보의 안전성 확보를 위해 다음의 조치를 취하고 있습니다.\n\n[기술적 조치]\n  • 마켓 OAuth Access/Refresh Token 및 API Key 의 Postgres pgcrypto 컬럼 단위 암호화 저장\n  • Supabase Row Level Security(RLS) 정책으로 셀러 본인 데이터에만 접근 가능하도록 강제\n  • HTTPS 전송 구간 암호화 (TLS 1.3)\n  • Sentry SDK `beforeSend` 훅에서 이메일·전화번호·토큰·API Key 자동 마스킹\n  • 비밀번호의 단방향 해시(bcrypt) 저장\n\n[관리적 조치]\n  • 개인정보 처리 직원의 최소화 및 접근 권한 차등 부여\n  • 정기적인 보안 점검 및 취약점 진단\n  • 외부 마켓 API 호출 시 토큰·PII 를 로그에서 제외하는 구조화 로깅 정책\n\n[물리적 조치]\n  • 모든 데이터는 Supabase 의 국제표준 보안 인증을 받은 데이터센터에 저장',
        },
        officer: {
          title: '제10조 (개인정보 보호책임자)',
          body:
            '회사는 개인정보 처리에 관한 업무를 총괄하여 책임지고, 개인정보 처리와 관련한 정보주체의 불만 처리 및 피해 구제를 위해 다음과 같이 개인정보 보호책임자를 지정하고 있습니다.\n\n  • 개인정보 보호책임자: (운영 전 확정 예정)\n  • 연락처: privacy@marketcast.example (운영 전 실제 도메인으로 교체)\n\n정보주체는 회사의 서비스를 이용하시면서 발생한 모든 개인정보 보호 관련 문의·불만 처리·피해 구제 등에 관한 사항을 위 연락처로 문의하실 수 있습니다.',
        },
      },
    },
    manual: {
      title: '사용자 매뉴얼',
      subtitle: 'MarketCast 를 처음 사용하는 셀러를 위한 5단계 가이드입니다.',
      sections: {
        signup: {
          title: '1. 회원가입 및 마켓 연결',
          body:
            '① 회원가입\n  • 우상단 [회원가입] 버튼을 클릭하여 이메일·비밀번호·표시 이름을 입력합니다.\n  • 비밀번호는 10자 이상, 영문 대소문자·숫자·특수문자 중 3종 이상 포함을 권장합니다.\n  • 이용약관과 개인정보처리방침 동의는 필수이며, 마케팅 수신 동의는 선택입니다.\n  • 가입 후 등록한 이메일로 발송된 인증 메일의 링크를 클릭해야 로그인이 가능합니다.\n\n② 마켓 연결 (좌측 메뉴 → 마켓 계정)\n  • [신규 연결] 버튼을 클릭하여 연결할 마켓을 선택합니다.\n  • 네이버 스마트스토어: OAuth 인증 화면으로 이동 → 마켓 로그인 → 권한 동의 → 자동 복귀.\n  • 쿠팡: Wing OpenAPI 에서 발급받은 Access Key / Secret Key / Vendor ID 를 직접 입력합니다.\n  • G마켓 / 옥션: ESM+ 콘솔에서 발급받은 Master ID / Access Key / Secret Key 를 입력합니다.\n  • 11번가는 현재 오픈 준비 중이며, v2 단계에서 지원 예정입니다.',
        },
        register: {
          title: '2. 첫 상품 등록 (5단계 위저드)',
          body:
            '좌측 메뉴 [상품 등록] 으로 진입하면 5단계 위저드가 시작됩니다.\n\n  1단계 정보: 상품명, 판매가, 재고, 카테고리(마스터), 배송 정책을 입력합니다.\n  2단계 이미지: 드래그앤드롭 또는 클릭으로 이미지를 업로드합니다. 대표 이미지 1장 + 추가 이미지 최대 9장을 권장합니다.\n  3단계 마켓·카테고리: 등록할 마켓을 선택하고, 마켓별 카테고리 매핑을 설정합니다. 연결된 마켓만 선택 가능합니다.\n  4단계 미리보기: 마켓별 변환 결과를 미리 확인합니다. 경고(warning) 가 있어도 등록 진행은 가능하나, 오류(error) 가 있으면 등록이 차단됩니다.\n  5단계 결과: [등록 시작] 클릭 후 마켓별 등록 진행 상황을 실시간으로 확인합니다.\n\n각 단계의 [다음] 버튼이 비활성화된 경우, 마우스를 올리면 필요한 조건이 툴팁으로 표시됩니다.',
        },
        result: {
          title: '3. 등록 결과 확인 및 재시도 / 마켓 제외',
          body:
            '등록 결과 화면에서는 각 마켓별 진행 상태를 다음과 같이 확인할 수 있습니다.\n  • 성공: 외부 상품 ID 와 상품 URL 이 표시됩니다.\n  • 일부 성공(partial): 일부 마켓만 성공한 경우, 실패한 마켓에 대해 다음 액션이 가능합니다.\n    - [재시도]: 실패한 마켓에 대해 동일 조건으로 다시 시도합니다.\n    - [마켓 제외 후 등록]: 특정 마켓을 제외하고 새 등록 잡을 생성합니다(원본 잡 ID 가 부모로 연결됩니다).\n  • 실패: 오류 코드와 메시지가 표시됩니다. 메시지가 길 경우 [더보기] 로 펼칠 수 있습니다.\n\n등록 잡은 마켓별로 독립적으로 실행되므로, 한 마켓의 실패가 다른 마켓의 진행을 막지 않습니다.',
        },
        history: {
          title: '4. 등록 이력 검색 및 필터',
          body:
            '좌측 메뉴 [등록 이력] 에서 과거 등록 잡을 조회할 수 있습니다.\n\n  • 기간 필터: 오늘 / 7일 / 30일 / 직접 입력 중 선택합니다.\n  • 마켓 필터: 특정 마켓만 보고 싶을 때 다중 선택합니다.\n  • 상태 필터: 성공 / 일부 성공 / 실패 / 재시도 중 / 대기 / 진행 중 / 취소 중 다중 선택합니다.\n  • 키워드 검색: 상품명·외부 상품 ID 일부로 검색합니다.\n  • 무한 스크롤: 하단에 도달하면 다음 페이지가 자동으로 로드됩니다.\n\n각 행을 클릭하면 상세 페이지로 이동하여 마켓별 결과, 오류 메시지, 재시도/제외 액션을 사용할 수 있습니다.',
        },
        faq: {
          title: '5. FAQ 및 트러블슈팅',
          body:
            'Q1. 마켓 토큰이 만료되었다는 알림이 떴어요.\n  A. 마켓 페이지에서 해당 마켓의 [재인증] 버튼을 클릭하면 OAuth 흐름이 다시 시작됩니다. 재인증 후에는 만료된 토큰이 자동으로 새 토큰으로 교체됩니다.\n\nQ2. 401 Unauthorized 오류가 표시됩니다.\n  A. 마켓 자격증명이 만료되었거나 권한이 회수된 경우입니다. 마켓 페이지에서 해당 마켓의 연결을 해제하고 새로 연결하세요. 쿠팡·G마켓·옥션은 키를 외부 콘솔에서 재발급한 후 다시 입력해야 합니다.\n\nQ3. 이미지 규격 오류가 발생합니다.\n  A. 각 마켓은 이미지 크기·포맷·용량 제한이 다릅니다. 일반적으로 JPEG/PNG 형식, 가로 1000px 이상, 파일당 10MB 이하를 권장합니다. 4단계 미리보기에서 경고로 표시되며, 자동 변환되는 항목은 그대로 진행 가능합니다.\n\nQ4. 등록 중 일부 마켓만 실패합니다.\n  A. 마켓별로 카테고리·필수필드·금지어 정책이 다릅니다. 실패 상세에서 오류 메시지를 확인하고, [마켓 제외 후 등록] 으로 우선 성공시킨 뒤 실패 마켓은 정책에 맞게 정보를 수정해 재등록하세요.\n\nQ5. 비밀번호를 잊었어요.\n  A. 로그인 화면에서 [비밀번호를 잊으셨나요?] 링크를 클릭하면 가입 이메일로 재설정 링크가 발송됩니다.',
        },
        shippingIntro: {
          title: '6. 주문·배송 자동화 (v2)',
          body:
            'v2 부터 4개 마켓의 주문이 자동으로 수집되고, 로젠택배로 일괄 등록·운송장 출력·송장 제출까지 한 번에 처리됩니다.\n\n전체 일과 흐름:\n  ① (자동) 10분마다 4개 마켓에서 신규 주문을 수집합니다.\n  ② (자동) 수집된 주문이 로젠택배에 자동 등록되어 운송장번호가 발급됩니다.\n  ③ (수동 1클릭) [주문·배송 → 운송장 출력] 에서 출력 버튼을 눌러 운송장을 프린터로 출력합니다.\n  ④ (자동 또는 1클릭) "출력 후 자동 제출" 이 ON 이면 출력 직후 4개 마켓에 송장번호가 자동 제출됩니다. OFF 면 [송장 일괄 제출] 을 직접 눌러야 합니다.',
        },
        shippingLogen: {
          title: '7. 로젠 API 설정 (최초 1회)',
          body:
            '좌측 메뉴 [설정 → 배송 설정] 으로 진입합니다.\n\n  ① [로젠 API 설정] 클릭\n  ② 로젠택배 영업소에서 발급받은 userId(연동업체코드)·custCd(거래처코드) 를 입력합니다.\n  ③ [연결 테스트] 를 눌러 자격증명이 유효한지 확인합니다.\n     - 성공: "연결됨" 상태가 표시되고 운송장 자동 발급이 활성화됩니다.\n     - 실패 — 잘못된 코드: 영업소를 통해 정확한 코드를 다시 확인합니다.\n     - 실패 — 계약 미완료: 로젠택배 B2B 계약 상태를 영업소에 문의합니다.\n  ④ [발송인 정보] 에서 발송인명·발송지 주소·연락처·운임 타입(fareTy)·운임(dlvFare) 을 입력합니다.\n     - fareTy 와 dlvFare 는 계약 시 확정된 값을 사용해야 합니다 (일반적으로 fareTy = "C").\n  ⑤ 모든 정보 입력이 끝나면 다음 주문 수집부터 자동 등록 흐름이 동작합니다.',
        },
        shippingPrint: {
          title: '8. 운송장 출력 (1일 1회)',
          body:
            '좌측 메뉴 [주문·배송 → 운송장 출력] 으로 진입합니다.\n\n  • 미출력 운송장 목록이 표시됩니다 (`logen_registered` 상태).\n  • [운송장 출력] 버튼을 누르면 로젠 양식 팝업이 열리며, 브라우저 인쇄 다이얼로그가 실행됩니다.\n  • 라벨 프린터로 출력 후 상자에 부착합니다.\n  • [출력 완료] 버튼을 누르면 주문 상태가 `waybill_printed` 로 전환됩니다.\n  • "출력 후 자동 제출" 이 ON 이면 이 시점부터 자동으로 마켓 송장 제출이 시작됩니다.',
        },
        shippingSubmit: {
          title: '9. 마켓 송장 제출',
          body:
            '"출력 후 자동 제출" 이 OFF 인 경우 [주문·배송 → 송장 일괄 제출] 에서 직접 트리거합니다.\n\n  • 송장 제출은 4개 마켓에 병렬로 진행되며 일반적으로 30초 이내에 완료됩니다.\n  • 마켓 중 일부만 실패한 경우, 해당 마켓만 선택하여 재시도할 수 있습니다.\n  • 제출이 완료된 주문은 상태가 `tracking_submitted` 로 전환되며, [배송 이력] 에서 확인할 수 있습니다.',
        },
        shippingTrouble: {
          title: '10. 배송 자동화 트러블슈팅',
          body:
            'Q1. 로젠 자동 등록이 실패한 주문이 있어요.\n  A. [주문·배송 → 주문 목록] 에서 `logen_failed` 상태 주문을 확인합니다. 사유가 일시 오류(rate limit 등) 이면 자동 재시도되며, 수취인 주소 누락 등 검증 실패는 주문 상세에서 수정 후 [재시도] 합니다.\n\nQ2. 운송장이 너무 많아 한 번에 출력하기 어려워요.\n  A. 출력 화면에서 마켓별 또는 날짜별로 필터링하여 분할 출력할 수 있습니다. 출력 완료 표시는 묶음 단위로 가능합니다.\n\nQ3. 마켓 송장 제출이 일부만 성공했어요.\n  A. 실패한 마켓의 오류 메시지를 확인하고, 자격증명 만료가 원인이면 [마켓 계정] 에서 재인증한 뒤 [재시도] 합니다.\n\nQ4. "출력 후 자동 제출" 을 OFF 로 두고 싶어요.\n  A. [설정 → 배송 설정] 에서 토글로 즉시 변경됩니다. 변경 즉시 다음 출력부터 적용됩니다.',
        },
      },
    },
  },
} as const

export type Locale = typeof ko
