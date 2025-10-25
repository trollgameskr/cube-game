# cube-game
3x3큐브게임

## 🎮 게임 소개
브라우저에서 즐기는 3D 큐브 퍼즐 게임입니다. 드래그로 큐브를 회전하고 버튼으로 면을 돌려 모든 면을 단색으로 맞추세요!

## ✨ 주요 기능
- 🎯 **3D 시각화**: CSS 3D 변환을 사용한 실시간 3D 큐브 렌더링
- 🖱️ **마우스/터치 컨트롤**: 드래그하여 큐브를 자유롭게 회전
- 🎮 **버튼 컨트롤**: 각 면(U, D, L, R, F, B)을 버튼으로 회전
- 🎲 **자동 섞기**: 게임 시작 시 랜덤으로 큐브 섞기
- 🏆 **승리 감지**: 모든 면이 단색이 되면 자동으로 축하 메시지 표시
- 📊 **이동 횟수 추적**: 몇 번의 이동으로 퍼즐을 풀었는지 확인
- ⏱️ **타이머 기능**: 게임 시작부터 완료까지의 시간 측정
- 🌐 **글로벌 순위**: 모든 기기에서 공유되는 실시간 리더보드
- 🎖️ **개인 기록 저장**: 닉네임과 함께 최고 기록을 순위표에 등록
- 🔄 **리셋 기능**: 언제든지 새로운 게임 시작
- 💡 **힌트 기능**: 도움이 필요할 때 힌트 확인
- 📱 **반응형 디자인**: 모바일과 데스크톱 모두 지원

## 🎮 게임 방법
1. 마우스나 터치로 드래그하여 큐브를 회전하고 다양한 각도에서 확인
2. 버튼이나 키보드 단축키로 큐브의 각 면을 회전
3. 모든 면을 단색으로 맞추면 클리어!
4. 완료 시 닉네임을 입력하여 글로벌 순위표에 기록 등록

## 🌐 글로벌 순위 시스템
- **실시간 리더보드**: Firebase Firestore를 사용하여 모든 기기에서 공유되는 순위표
- **자동 기록**: 큐브 완성 시 이동 횟수와 소요 시간이 자동으로 기록됩니다
- **닉네임 저장**: 한 번 입력한 닉네임은 로컬에 저장되어 다음 게임에서도 사용 가능
- **Top 10 표시**: 최고 기록 상위 10명을 실시간으로 표시
- **정렬 기준**: 이동 횟수가 적을수록, 시간이 빠를수록 상위 순위


## 🚀 GitHub Pages 배포
이 게임은 GitHub Pages로 배포할 수 있습니다:

1. Repository Settings로 이동
2. Pages 섹션 찾기
3. Source를 "main" 브랜치로 설정
4. 저장하면 자동으로 배포됩니다

배포 URL: http://trollgameskr.github.io/cube-game/

## 🛠️ 기술 스택
- **HTML5**: 게임 구조
- **CSS3**: 스타일링 및 3D 변환 (transform-style: preserve-3d)
- **JavaScript (ES6+)**: 게임 로직
- **CSS 3D Transforms**: 3D 큐브 렌더링 (외부 라이브러리 불필요)
- **Firebase Firestore**: 실시간 글로벌 순위표 데이터베이스
- **Three.js**: 3D 렌더링 라이브러리

## 🔧 Firebase 설정 (선택사항)
글로벌 순위 기능을 사용하려면 Firebase 프로젝트가 필요합니다:

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성
2. Firestore Database 활성화
3. 웹 앱 등록 후 구성 정보 복사
4. `index.html`의 Firebase 설정 부분을 실제 프로젝트 정보로 교체:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

5. Firestore 보안 규칙 설정:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{score} {
      allow read: if true;
      allow create: if request.resource.data.nickname is string 
                    && request.resource.data.moves is number
                    && request.resource.data.time is number;
    }
  }
}
```

**참고**: Firebase를 설정하지 않아도 게임은 정상적으로 작동하며, 데모 순위표가 표시됩니다.

## 📝 라이선스
MIT License

## 🎯 성능
- ✅ 초기 로딩: 2초 이내
- ✅ 프레임레이트: 60FPS 유지
- ✅ 반응형: 모바일/태블릿/데스크톱 지원

