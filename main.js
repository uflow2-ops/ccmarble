window.Synth = {
    ctx: null,
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    playNote(freq, type, duration, vol=0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    play(effect) {
        this.init();
        switch(effect) {
            case 'start':
                this.playNote(440, 'square', 0.1);
                setTimeout(() => this.playNote(554, 'square', 0.1), 100);
                setTimeout(() => this.playNote(659, 'square', 0.3), 200);
                break;
            case 'move':
                this.playNote(600, 'sine', 0.1);
                break;
            case 'roll':
                for(let i=0; i<4; i++) {
                    setTimeout(() => this.playNote(150 + Math.random()*100, 'triangle', 0.05), i*60);
                }
                break;
            case 'correct':
                this.playNote(523.25, 'sine', 0.15);
                setTimeout(() => this.playNote(659.25, 'sine', 0.15), 150);
                setTimeout(() => this.playNote(783.99, 'sine', 0.3), 300);
                break;
            case 'wrong':
                this.playNote(300, 'sawtooth', 0.2);
                setTimeout(() => this.playNote(250, 'sawtooth', 0.3), 150);
                break;
            case 'win':
                [523.25, 523.25, 523.25, 659.25, 783.99, 659.25, 783.99].forEach((freq, i) => {
                    setTimeout(() => this.playNote(freq, 'square', i===6?0.6:0.15), i*150);
                });
                break;
        }
    }
};

window.players = [];
window.currentPlayer = 0;
window.isMoving = false;
window.landOwnership = {};
window.lastPlayerPos = 0;

const PLAYER_COLORS = [
    { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', name: '빨강' },
    { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', name: '파랑' },
    { bg: '#dcfce7', border: '#10b981', text: '#166534', name: '초록' },
    { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', name: '노랑' }
];

const AVAILABLE_ANIMALS = ['🐶 강아지', '🐱 고양이', '🐰 토끼', '🦁 사자', '🐼 판다', '🦊 여우', '🐯 호랑이', '🐵 원숭이'];

/* ===== 🎲 이벤트 칸 무작위 뽑기 리스트 ===== */
const RANDOM_EVENTS = [
    { title: "🎁 대박 행운!", desc: "춘천의 따뜻한 인심을 만나 지역 상품권을 선물받았습니다!\n(+150점 획득)", score: 150, move: 0 },
    { title: "🚀 바람을 가르는 스피드!", desc: "지름길을 발견하여 신나게 달려갑니다!\n(앞으로 2칸 전진)", score: 0, move: 2 },
    { title: "🍗 맛있는 음식 탐방", desc: "춘천의 명물 음식을 맛있게 먹고 힘이 납니다!\n(+80점 획득)", score: 80, move: 0 },
    { title: "💸 지갑을 잃어버릴 뻔!", desc: "기념품을 사느라 예산을 생각보다 많이 썼습니다.\n(-50점 감점)", score: -50, move: 0 },
    { title: "🌀 앗, 길을 착각했다!", desc: "풍경에 눈이 팔려 길을 잘못 들어섰습니다.\n(뒤로 2칸 후퇴)", score: 0, move: -2 },
    { title: "☔ 갑작스러운 소나기", desc: "갑자기 비가 내려 근처 쉼터에서 비를 피합니다.\n(다음 1턴 쉬어가기)", score: 0, move: 0, skip: 1 }
];

window.boardData = [
  { id: 0, name: "출발! (춘천역)", category: "출발", catClass: "cat-start", icon: "🏁", row: 1, col: 1, img: "https://images.unsplash.com/photo-1543716627-839b54c40519?auto=format&fit=crop&w=600&q=80", desc: "경춘선의 출발점이자 종착역! 춘천 체크인을 시작합니다." },
  { id: 1, name: "춘천시청", category: "공공기관", catClass: "cat-public", icon: "🏛️", row: 1, col: 2, img: "https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=600&q=80", desc: "춘천 시민들의 행복과 시 살림을 맡아 처리하는 곳입니다.",
    question: "춘천시청은 우리 고장을 위해 어떤 일을 하는 곳일까요?", options: ["불을 꺼준다", "시의 행정과 주민 복지를 담당한다", "아픈 사람을 치료한다"], answer: 1, exp: "시청은 우리 고장의 발전과 주민 복지를 위해 일합니다.",
    question2: "시청에서 시장님과 공무원들이 모여 우리 고장의 중요한 일을 결정하는 회의실은?", options2: ["상황실(회의실)", "수영장", "영화관"], answer2: 0, exp2: "시청에는 고장의 중요한 일을 의논하고 결정하는 회의 공간이 있습니다.",
    question3: "춘천시를 대표하여 시청에서 가장 높은 책임을 지고 일하는 사람은 누구일까요?", options3: ["시장", "교장 선생님", "경찰서장"], answer3: 0, exp3: "우리 고장의 살림을 책임지는 대표를 '시장'이라고 부릅니다."
  },
  { id: 2, name: "춘천소방서", category: "공공기관", catClass: "cat-public", icon: "🚒", row: 1, col: 3, img: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80", desc: "화재 예방과 긴급 구조 활동을 수행하는 안전 기관입니다.",
    question: "화재나 긴급 구조 상황 발생 시 신고 전화번호는?", options: ["112", "119", "114"], answer: 1, exp: "긴급 화재 및 구조 신고 전화는 119입니다.",
    question2: "소방관 아저씨들이 화재 진압뿐만 아니라 벌집을 제거하거나 갇힌 사람을 구하는 활동을 무엇이라고 할까요?", options2: ["구조·구급 활동", "경찰 활동", "청소 활동"], answer2: 0, exp2: "소방서는 불을 끄는 일 외에도 사람들의 생명을 구하는 다양한 구조 활동을 합니다.",
    question3: "불이 났을 때 초기 진압을 위해 학교나 건물마다 비치되어 있는 빨간색 소화 도구는?", options3: ["소화기", "분무기", "주사기"], answer3: 0, exp3: "작은 불씨일 때 소화기를 사용하면 큰불로 번지는 것을 막을 수 있습니다."
  },
  { id: 3, name: "춘천경찰서", category: "공공기관", catClass: "cat-public", icon: "👮", row: 1, col: 4, img: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80", desc: "마을의 질서를 유지하고 범죄를 예방하여 안전을 지킵니다.",
    question: "우리 동네의 질서와 안전을 지켜주는 곳은 어디일까요?", options: ["경찰서", "도서관", "우체국"], answer: 0, exp: "경찰관 아저씨들이 시민의 안전을 지켜주십니다.",
    question2: "길을 잃어버렸거나 위험한 상황에 처했을 때, 경찰관에게 도움을 요청하는 전화번호는?", options2: ["112", "119", "1336"], answer2: 0, exp2: "범죄 신고나 위험할 때 긴급하게 도움을 요청하는 번호는 112입니다.",
    question3: "길을 건널 때 안전을 위해 우리가 꼭 지켜야 하는 신호등의 색깔은?", options3: ["초록불", "빨간불", "노란불"], answer3: 0, exp3: "초록불이 켜져도 멈춰 서서 좌우를 살핀 후 건너는 습관이 중요합니다."
  },
  { id: 4, name: "닭갈비 파티", category: "이벤트", catClass: "cat-event", icon: "🍗", row: 1, col: 5, img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80", desc: "도착할 때마다 다양한 무작위 이벤트가 발생합니다!" },
  { id: 5, name: "춘천시립도서관", category: "공공기관", catClass: "cat-public", icon: "📚", row: 1, col: 6, img: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=600&q=80", desc: "책을 빌려 읽고 공부할 수 있는 고장의 문화 공공시설입니다.",
    question: "도서관은 어떤 성격을 가진 기관인가요?", options: ["공공 시설", "개인 가게", "유료 테마파크"], answer: 0, exp: "도서관은 누구나 이용할 수 있는 공공 시설입니다.",
    question2: "도서관에서 책을 집으로 빌려 갈 때 꼭 필요한 카드는 무엇일까요?", options2: ["도서 대출증", "신용카드", "교통카드"], answer2: 0, exp2: "도서관에서 책을 빌리려면 회원 가입 후 도서 대출증을 만들어야 해요.",
    question3: "도서관에서 빌린 책을 다 읽은 후에는 어떻게 해야 할까요?", options3: ["깨끗하게 보고 기한 내에 반납한다", "친구에게 준다", "내 책꽂이에 꽂아둔다"], answer3: 0, exp3: "여러 사람이 함께 보는 책이므로 소중히 다루고 제때 돌려주어야 합니다."
  },
  { id: 6, name: "담작은도서관", category: "공공기관", catClass: "cat-public", icon: "📖", row: 1, col: 7, img: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=600&q=80", desc: "골목길 안에 위치한 친근하고 따뜻한 어린이 도서관입니다.",
    question: "담작은도서관은 아기자기한 골목길에 있어요. 도서관 이름 중 '담'은 무엇을 뜻할까요?", options: ["마음 담기", "담장(담벼락)", "담다디 노래"], answer: 1, exp: "담작은도서관은 정겨운 골목길 담장 아래 자리 잡은 따뜻한 어린이 공간입니다!",
    question2: "도서관처럼 사람들이 모여서 함께 책을 읽는 곳에서 꼭 지켜야 할 예절은?", options2: ["조용히 걷고 작은 소리로 말하기", "술래잡기 하기", "과자 먹으며 책 보기"], answer2: 0, exp2: "여러 사람이 함께 쓰는 공공장소에서는 다른 사람을 배려하는 조용한 태도가 필요합니다.",
    question3: "책을 읽을 때 눈 건강을 지키기 위한 올바른 자세는?", options3: ["밝은 곳에서 바른 자세로 읽기", "엎드려서 읽기", "어두운 곳에서 찡그리고 읽기"], answer3: 0, exp3: "허리를 펴고 밝은 조명 아래서 책을 읽어야 눈이 나빠지지 않아요."
  },
  { id: 7, name: "삼악산 케이블카", category: "특수공간", catClass: "cat-corner", icon: "🚡", row: 1, col: 8, img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80", desc: "의암호와 삼악산의 환상적인 풍경을 감상하느라 시간 가는 줄 몰랐습니다! 한 턴 쉬어갑니다." },
  { id: 8, name: "김유정문학촌", category: "역사/문화", catClass: "cat-culture", icon: "✍️", row: 2, col: 8, img: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80", desc: "소설가 김유정 선생님의 생가와 작품 세계를 기리는 공간입니다.",
    question: "김유정 작가님의 대표작 '동백꽃'에 나오는 '노란 동백꽃'의 진짜 정체는 무엇일까요?", options: ["생강나무 꽃", "장미꽃", "해바라기"], answer: 0, exp: "강원도 방언에서는 알싸한 향이 나는 생강나무 꽃을 '동백꽃' 또는 '동박꽃'이라 불렀답니다!",
    question2: "김유정 작가님의 소설 '봄봄'과 '동백꽃'의 배경이 되는 춘천의 실제 마을 이름은?", options2: ["실레마을", "한옥마을", "민속촌"], answer2: 0, exp2: "김유정문학촌이 있는 신동면 증리 일대는 옛날부터 '실레마을'이라고 불렸습니다.",
    question3: "작가님처럼 내 생각이나 오늘 겪은 일을 매일매일 공책에 적는 글을 무엇이라고 할까요?", options3: ["일기", "설명서", "수학 문제"], answer3: 0, exp3: "일기를 쓰면 나의 하루를 되돌아보고 글쓰기 실력도 쑥쑥 키울 수 있어요."
  },
  { id: 9, name: "청평사", category: "역사/문화", catClass: "cat-culture", icon: "🛕", row: 3, col: 8, img: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=600&q=80", desc: "오봉산 자락에 자리 잡은 고려시대의 유명한 사찰입니다.",
    question: "청평사가 위치한 오봉산의 고려시대 사찰은?", options: ["청평사", "불국사", "해인사"], answer: 0, exp: "청평사는 고려 시대 회전문과 공주 설화가 전해집니다.",
    question2: "청평사 가는 길에 만날 수 있는 예쁜 폭포로, 아홉 가지 소리를 낸다고 해서 이름 붙여진 이 폭포는?", options2: ["구송폭포", "나이아가라 폭포", "천지연폭포"], answer2: 0, exp2: "구송폭포는 아홉 그루의 소나무가 있고 폭포 소리가 아름다워 붙여진 이름입니다.",
    question3: "산에 있는 절에 갈 때, 숲을 보호하기 위해 절대 하면 안 되는 행동은?", options3: ["쓰레기를 버리거나 불 장난하기", "조용히 걷기", "가족과 사진 찍기"], answer3: 0, exp3: "산불이 나면 소중한 자연과 문화재가 모두 타버릴 수 있으니 불조심이 가장 중요해요."
  },
  { id: 10, name: "김유정역 레일바이크", category: "이벤트", catClass: "cat-event", icon: "🚲", row: 4, col: 8, img: "https://images.unsplash.com/photo-1517649763962-0c623266010b?auto=format&fit=crop&w=600&q=80", desc: "도착할 때마다 다양한 무작위 이벤트가 발생합니다!" },
  { id: 11, name: "국립춘천박물관", category: "역사/문화", catClass: "cat-culture", icon: "🏛️", row: 5, col: 8, img: "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=600&q=80", desc: "강원도와 춘천의 역사를 한눈에 볼 수 있으며 어린이박물관도 마련되어 있습니다.",
    question: "우리 고장의 역사 유물을 보존하고 전시하는 곳은?", options: ["국립춘천박물관", "시청", "체육관"], answer: 0, exp: "박물관은 옛날 사람들의 유물을 보존하고 전시합니다.",
    question2: "박물관에서 전시하는 옛날 사람들이 쓰던 토기나 돌도끼 같은 오래되고 소중한 물건들을 무엇이라고 부를까요?", options2: ["유물", "신상 장난감", "재활용품"], answer2: 0, exp2: "역사적 가치가 있는 옛날 사람들의 물건을 '유물'이라고 합니다.",
    question3: "박물관에 있는 유물들을 보며 우리는 무엇을 알 수 있을까요?", options3: ["옛날 사람들의 생활 모습", "내일의 날씨", "새로 나온 게임"], answer3: 0, exp3: "유물을 통해 아주 먼 옛날 사람들이 어떻게 옷을 입고 밥을 먹었는지 상상해 볼 수 있어요."
  },
  { id: 12, name: "애니메이션박물관", category: "역사/문화", catClass: "cat-culture", icon: "🎬", row: 6, col: 8, img: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80", desc: "국내 유일의 애니메이션 전문 박물관입니다.",
    question: "정지된 그림들을 조금씩 다르게 하여 빠르게 이어 붙여 움직이는 것처럼 보이게 만드는 기술은?", options: ["애니메이션", "마술", "사진첩"], answer: 0, exp: "그림에 생명을 불어넣어 움직이게 만드는 예술을 애니메이션이라고 해요!",
    question2: "춘천 애니메이션박물관 바로 옆에 있는 곳으로, 로봇을 직접 만져보고 조종해볼 수 있는 체험관의 이름은?", options2: ["토이로봇관", "공룡박물관", "우주센터"], answer2: 0, exp2: "애니메이션박물관 바로 옆에는 로봇과 장난감을 재미있게 체험하는 토이로봇관이 있어요!",
    question3: "재미있는 만화나 스마트폰 영상을 볼 때 꼭 지켜야 할 올바른 약속은?", options3: ["부모님과 약속한 시간만 시청하기", "하루 종일 보기", "밥 먹을 때 계속 보기"], answer3: 0, exp3: "영상 시청은 정해진 시간 동안만 즐겁게 보고, 끝나면 눈을 쉬어주는 것이 좋아요."
  },
  { id: 13, name: "춘천인형극장", category: "역사/문화", catClass: "cat-culture", icon: "🎭", row: 7, col: 8, img: "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=600&q=80", desc: "매년 춘천인형극제가 열리는 전용 공연장입니다.",
    question: "손가락이나 줄을 이용해 인형을 조종하며 연기하는 극을 무엇이라고 할까요?", options: ["인형극", "뮤지컬", "서커스"], answer: 0, exp: "춘천은 매년 세계 각국의 인형극단이 모여 재미있는 축제를 여는 인형극의 도시랍니다.",
    question2: "인형극에서 무대 뒤나 아래에 숨어서 인형을 생동감 있게 움직이고 목소리를 내는 사람을 무엇이라고 할까요?", options2: ["인형 조종사(인형극 배우)", "관객", "마술사"], answer2: 0, exp2: "인형극 배우들은 인형이 진짜 살아있는 것처럼 멋지게 연기하며 이야기를 들려줍니다.",
    question3: "공연이 끝난 후 멋진 연기를 보여준 배우들에게 보내는 관객들의 감사의 표시는?", options3: ["큰 박수 치기", "소리 지르기", "쓰레기 던지기"], answer3: 0, exp3: "공연이 끝난 후에는 고생한 배우들을 위해 아낌없는 박수를 보내는 것이 멋진 관람 예절입니다."
  },
  { id: 14, name: "마임축제 찬스!", category: "특수공간", catClass: "cat-corner", icon: "🎉", row: 8, col: 8, img: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80", desc: "춘천 세계마임축제에 참여했습니다! 보너스 점수 +100점!" },
  { id: 15, name: "레고랜드", category: "자연/관광", catClass: "cat-nature", icon: "🏰", row: 8, col: 7, img: "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=600&q=80", desc: "의암호 하중도에 위치한 인기 테마파크입니다.",
    question: "레고랜드 테마파크가 위치한 의암호 안의 섬은?", options: ["하중도", "남이섬", "독도"], answer: 0, exp: "레고랜드는 의암호 하중도에 만들어졌습니다.",
    question2: "레고랜드 테마파크를 지을 때 사용된 알록달록한 조립 블록 장난감의 이름은?", options2: ["레고(LEGO)", "찰흙", "나무토막"], answer2: 0, exp2: "레고랜드는 수많은 레고 블록으로 만들어진 조형물과 신나는 놀이기구가 있는 곳입니다.",
    question3: "놀이기구를 타기 위해 사람들이 많이 모였을 때 우리가 꼭 지켜야 할 질서는?", options3: ["차례대로 줄 서기", "새치기 하기", "밀치기"], answer3: 0, exp3: "모두가 즐겁고 안전하게 놀기 위해서는 내 차례를 기다리는 줄 서기 규칙이 아주 중요해요."
  },
  { id: 16, name: "남이섬", category: "자연/관광", catClass: "cat-nature", icon: "🌲", row: 8, col: 6, img: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80", desc: "키가 큰 나무들과 귀여운 동물들이 반겨주는 섬입니다.",
    question: "남이섬 안에서 마음껏 깡총깡총 뛰어다니는 귀여운 마스코트 동물은?", options: ["남이섬 깡타(타조)와 토끼", "북극곰", "사막여우"], answer: 0, exp: "남이섬에서는 길거리에서 자라나는 토끼와 장난꾸러기 타조 '깡타'를 만날 수 있어요!",
    question2: "남이섬의 아름다운 길 중 하나로, 키가 아주 큰 나무들이 양옆으로 길게 서 있는 유명한 숲길은?", options2: ["메타세쿼이아 길", "장미꽃 길", "선인장 길"], answer2: 0, exp2: "하늘 높이 뻗은 웅장한 메타세쿼이아 나무들이 줄지어 있는 길은 남이섬의 자랑입니다.",
    question3: "남이섬처럼 커다란 나무가 울창한 숲은 우리에게 어떤 좋은 점을 줄까요?", options3: ["맑고 깨끗한 공기를 만들어 준다", "미세먼지를 만든다", "시끄러운 소리를 낸다"], answer3: 0, exp3: "나무들은 공기 중의 나쁜 물질을 마시고 우리가 숨 쉬기 좋은 깨끗한 산소를 내뿜어 줍니다."
  },
  { id: 17, name: "막국수 닭갈비 축제", category: "이벤트", catClass: "cat-event", icon: "🍜", row: 8, col: 5, img: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=600&q=80", desc: "도착할 때마다 다양한 무작위 이벤트가 발생합니다!" },
  { id: 18, name: "해피초원목장", category: "자연/관광", catClass: "cat-nature", icon: "🐑", row: 8, col: 4, img: "https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=600&q=80", desc: "한국의 알프스라 불리는 아름다운 호수 뷰 목장입니다.",
    question: "O/X 퀴즈! 초원목장의 귀여운 양들에게 건초 먹이를 줄 때 손가락을 물리지 않도록 조심해야 한다?", options: ["O (맞다)", "X (틀리다)"], answer: 0, exp: "동물 먹이 주기 체험을 할 때는 바구니나 전용 바가지에 건초를 담아 안전하게 주어야 해요!",
    question2: "목장에 있는 소, 양, 토끼 같은 초식 동물들이 주로 먹는 말린 풀을 무엇이라고 부를까요?", options2: ["건초", "햄버거", "아이스크림"], answer2: 0, exp2: "초식동물들은 영양분이 풍부한 말린 풀인 '건초'를 먹고 쑥쑥 자랍니다.",
    question3: "목장에서 키우는 건강한 소(젖소)가 우리에게 주는 튼튼하고 하얀 마실 거리는?", options3: ["우유", "콜라", "사이다"], answer3: 0, exp3: "칼슘이 듬뿍 들어있는 우유는 우리의 뼈를 튼튼하게 만들어 줍니다."
  },
  { id: 19, name: "소양강댐", category: "자연/관광", catClass: "cat-nature", icon: "🌊", row: 8, col: 3, img: "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=600&q=80", desc: "동양 최대 규모의 흙과 돌로 쌓은 다목적댐입니다.",
    question: "소양강댐처럼 물을 막아두는 댐이 하는 일이 아닌 것은 무엇일까요?", options: ["홍수를 막아준다", "가뭄 때 물을 보내준다", "바닷물을 만들어낸다"], answer: 2, exp: "댐은 홍수 예방, 전기 생산, 생활용수 공급을 해주지만 바닷물을 만드는 곳은 아니랍니다.",
    question2: "소양강에 있는 명소 중 하나로, 바닥이 투명한 유리로 되어 있어 물 위를 걷는 듯한 짜릿한 다리의 이름은?", options2: ["소양강 스카이워크", "골든게이트 브릿지", "징검다리"], answer2: 0, exp2: "스카이워크는 투명한 유리 바닥 아래로 강물이 흘러가는 것을 직접 볼 수 있는 멋진 장소입니다.",
    question3: "댐에 모아둔 소중한 물을 일상생활에서 아껴 쓰기 위한 알맞은 행동은?", options3: ["양치할 때 컵에 물을 받아서 쓰기", "물을 틀어놓고 장난치기", "수도꼭지 안 잠그기"], answer3: 0, exp3: "양치컵을 사용하거나 세수할 때 물을 받아서 쓰면 많은 물을 절약할 수 있습니다."
  },
  { id: 20, name: "육림랜드", category: "자연/관광", catClass: "cat-nature", icon: "🎡", row: 8, col: 2, img: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=600&q=80", desc: "회전목마와 공중그네가 있는 추억의 놀이동산입니다.",
    question: "놀이기구를 탈 때 안전을 위해 꼭 지켜야 하는 규칙은 무엇일까요?", options: ["안전벨트 착용하기", "운행 중에 일어서기", "장난치며 뛰어내리기"], answer: 0, exp: "놀이기구에서는 바른 자세로 안전벨트를 꼭 매야 신나고 안전하게 즐길 수 있어요!",
    question2: "육림랜드처럼 여러 가지 놀이기구가 모여 있는 장소를 사람들은 주로 어떤 목적으로 이용할까요?", options2: ["가족들과 여가를 즐기기 위해", "물건을 팔기 위해", "농사를 짓기 위해"], answer2: 0, exp2: "여가 시간은 공부나 일이 끝난 후 즐겁게 휴식하는 시간입니다. 놀이공원은 대표적인 여가 시설이에요.",
    question3: "회전목마를 탈 때 말이 오르락내리락 움직입니다. 이때 다치지 않으려면 손은 어떻게 해야 할까요?", options3: ["기둥 손잡이를 꽉 잡는다", "두 손을 높이 든다", "친구를 밀어낸다"], answer3: 0, exp3: "놀이기구가 움직일 때는 중심을 잃지 않도록 마련된 손잡이를 꼭 잡아야 합니다."
  },
  { id: 21, name: "춘천 물레길 카누", category: "특수공간", catClass: "cat-corner", icon: "🚣", row: 8, col: 1, img: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80", desc: "의암호 물레길에서 신나게 카누를 타고 물길을 따라 출발지(춘천역)로 즉시 이동합니다!" },
  { id: 22, name: "박사마을글램핑장", category: "자연/관광", catClass: "cat-nature", icon: "⛺", row: 7, col: 1, img: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80", desc: "의암호변의 아름다운 풍경 속 캠핑장입니다.",
    question: "'글램핑'이란 단어의 뜻으로 가장 어울리는 것은 무엇일까요?", options: ["모든 장비가 준비된 고급스럽고 편리한 캠핑", "맨몸으로 야외에서 잠자기", "우주선 타고 여행하기"], answer: 0, exp: "글램핑(Glamping)은 텐트나 장비가 미리 준비되어 있어 누구나 쉽게 즐기는 캠핑이에요!",
    question2: "텐트를 치고 자연 속에서 캠핑을 할 때, 환경을 보호하기 위해 꼭 지켜야 할 행동은?", options2: ["쓰레기는 되가져가거나 분리수거하기", "나무 꺾기", "아무데나 불 피우기"], answer2: 0, exp2: "아름다운 춘천의 자연을 지키기 위해서는 머문 자리를 깨끗하게 정리해야 합니다.",
    question3: "캠핑장에서 고기를 구워 먹거나 '불멍'을 한 후, 남은 불씨는 어떻게 처리해야 할까요?", options3: ["물을 충분히 부어 완전히 끄기", "그대로 놔두고 잠자기", "발로 살짝 덮기"], answer3: 0, exp3: "작은 불씨라도 바람에 날리면 큰 화재로 이어질 수 있으므로 반드시 확실하게 꺼야 합니다."
  },
  { id: 23, name: "닭갈비 거리", category: "특산물/음식", catClass: "cat-food", icon: "🍗", row: 6, col: 1, img: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80", desc: "춘천을 대표하는 가장 명물 맛집 거리입니다.",
    question: "춘천을 대표하는 향토 음식 두 가지는?", options: ["닭갈비와 막국수", "비빔밥과 콩나물국", "짜장면과 탕수육"], answer: 0, exp: "춘천은 매콤한 닭갈비와 시원한 막국수가 유명합니다.",
    question2: "춘천 닭갈비를 커다란 둥근 철판에 볶을 때, 고기와 함께 듬뿍 들어가는 대표적인 채소는 무엇일까요?", options2: ["양배추", "수박", "미역"], answer2: 0, exp2: "달콤하고 아삭아삭한 양배추는 매콤한 닭갈비와 아주 잘 어울립니다.",
    question3: "닭갈비나 막국수처럼 그 지역에서 옛날부터 전해 내려오며 특별하게 만들어 먹는 음식을 무엇이라고 할까요?", options3: ["향토 음식 (특산물)", "패스트푸드", "우주 식량"], answer3: 0, exp3: "우리 고장의 자연환경과 사람들의 지혜가 담긴 소중한 음식을 향토 음식이라고 부릅니다."
  },
  { id: 24, name: "옥광산 보물찾기", category: "이벤트", catClass: "cat-event", icon: "💎", row: 5, col: 1, img: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=600&q=80", desc: "도착할 때마다 다양한 무작위 이벤트가 발생합니다!" },
  { id: 25, name: "춘천 막국수 체험관", category: "특산물/음식", catClass: "cat-food", icon: "🍜", row: 4, col: 1, img: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=600&q=80", desc: "메밀을 이용해 직접 막국수를 뽑아볼 수 있는 체험관입니다.",
    question: "막국수의 주재료가 되는 건강 곡물은?", options: ["메밀", "밀가루", "쌀"], answer: 0, exp: "춘천 막국수는 구수한 메밀로 만드는 전통 음식입니다.",
    question2: "메밀가루를 반죽해서 기계에 넣고 꾹 눌러 국수 가닥을 뽑아내는 옛날 방식의 도구를 무엇이라고 할까요?", options2: ["분틀(막국수 틀)", "오븐", "믹서기"], answer2: 0, exp2: "옛날 방식대로 전통 분틀을 이용해 힘껏 눌러야 쫄깃한 메밀 면이 나옵니다.",
    question3: "막국수 체험관의 주방처럼 뜨거운 불이나 칼이 있는 곳에서 음식을 만들 때 가장 주의해야 할 점은?", options3: ["어른과 함께 안전하게 행동하기", "장난치며 뛰어다기", "뜨거운 냄비 맨손으로 만지기"], answer: 0, exp3: "요리를 할 때는 항상 안전 수칙을 지키고 위험한 도구는 어른의 도움을 받아야 합니다."
  },
  { id: 26, name: "춘천 풍물시장", category: "특산물/음식", catClass: "cat-food", icon: "🏪", row: 3, col: 1, img: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=600&q=80", desc: "전통 장날의 정겨움을 느낄 수 있는 대표 5일장입니다.",
    question: "풍물시장은 날짜 끝자리가 '2일'과 '7일'에 열립니다. 다음 중 풍물시장이 열리는 날은?", options: ["12일", "15일", "20일"], answer: 0, exp: "춘천 풍물시장은 매달 2일, 7일, 12일, 17일, 22일, 27일에 열리는 신나는 5일장입니다!",
    question2: "시장처럼 사람들이 서로 필요한 물건을 사고파는 모든 활동을 우리 고장의 무엇이라고 할까요?", options2: ["경제 활동", "문화 유산", "자연 보호"], answer2: 0, exp2: "시장에서 돈을 내고 물건이나 음식을 사는 것은 대표적인 우리 고장의 경제 활동입니다.",
    question3: "시장에서 물건을 살 때, 정해진 가격만큼 지불하는 종이나 동전을 무엇이라고 할까요?", options3: ["돈 (화폐)", "딱지", "종이학"], answer3: 0, exp3: "물건과 교환하기 위해 사용하는 약속된 수단을 화폐(돈)라고 합니다."
  },
  { id: 27, name: "소양강 토마토", category: "특산물/음식", catClass: "cat-food", icon: "🍅", row: 2, col: 1, img: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80", desc: "깨끗한 물과 일조량으로 자란 춘천의 대표 농산물입니다.",
    question: "소양강 이름을 딴 춘천의 대표 붉은 농산물은?", options: ["소양강 토마토", "제주 감귤", "성환 배"], answer: 0, exp: "소양강 토마토는 당도와 품질이 뛰어납니다.",
    question2: "농부 아저씨들이 봄에 밭에 씨앗이나 모종을 심고, 시간이 지나 다 익은 열매를 거두어들이는 과정을 무엇이라고 할까요?", options2: ["수확(추수)", "낚시", "발명"], answer2: 0, exp2: "정성껏 기른 농작물을 거두어들이는 것을 '수확'이라고 매년 농부들의 가장 큰 기쁨입니다.",
    question3: "토마토나 사과 같은 농산물을 우리가 맛있게 먹기 전에는 겉에 묻은 흙을 어떻게 해야 할까요?", options3: ["흐르는 물에 깨끗이 씻어 먹는다", "옷에 쓱쓱 닦고 먹는다", "그냥 먹는다"], answer3: 0, exp3: "우리의 건강을 위해 껍질째 먹는 과일이나 채소는 반드시 물로 깨끗하게 씻어야 합니다."
  }
];

window.handleSpecialSpace = function (cell) {
    const p = window.players[window.currentPlayer];
    
    // 고정 특수 공간 처리
    if (cell.id === 7) { 
        alert(`🚡 ${cell.name}\n\n${cell.desc}`);
        window.skipPlayers[window.currentPlayer] = 1;
        window.rolledDouble = false;
        window.nextTurn();
        return;
    } else if (cell.id === 14) {
        p.score += 100;
        window.updateTokens();
        alert(`🎉 ${cell.name}\n\n${cell.desc}`);
        if (window.checkWinCondition()) return;
        window.nextTurn();
        return;
    } else if (cell.id === 21) {
        p.pos = 0;
        window.updateTokens();
        alert(`🚣 ${cell.name}\n\n${cell.desc}`);
        window.nextTurn();
        return;
    }

    // 무작위 랜덤 이벤트 공간 처리 (4, 10, 17, 24번)
    if ([4, 10, 17, 24].includes(cell.id)) {
        const randomIndex = Math.floor(Math.random() * RANDOM_EVENTS.length);
        const event = RANDOM_EVENTS[randomIndex];

        alert(`🎲 [${cell.name} - 랜덤 이벤트]\n\n${event.title}\n${event.desc}`);

        if (event.score !== 0) {
            p.score += event.score;
            if (p.score < 0) p.score = 0; 
        }

        if (event.skip) {
            window.skipPlayers[window.currentPlayer] = event.skip;
            window.rolledDouble = false;
        }

        window.updateTokens();
        if (window.checkWinCondition()) return;

        if (event.move !== 0) {
            window.movePlayer(event.move);
        } else {
            window.nextTurn();
        }
    }
};

window.skipPlayers = {}; 

window.updateNicknameFields = function () {
    const selectEl = document.getElementById('playerCountSelect');
    if (!selectEl) return;
    
    const count = parseInt(selectEl.value) || 2;
    const container = document.getElementById('nicknameFieldsContainer');
    if(!container) return;
    
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.style.marginBottom = '10px';
        div.style.background = '#fff';
        div.style.padding = '8px';
        div.style.borderRadius = '8px';
        div.style.border = `2px solid ${PLAYER_COLORS[i].border}`;

        let optionsHtml = '';
        AVAILABLE_ANIMALS.forEach((animal, idx) => {
            const selected = (idx === i) ? 'selected' : '';
            optionsHtml += `<option value="${animal.split(' ')[0]}" ${selected}>${animal}</option>`;
        });

        div.innerHTML = `
            <label style="font-weight:600; font-size:13px; margin-bottom:4px; display:block; color:${PLAYER_COLORS[i].text};">
                ${PLAYER_COLORS[i].name} 플레이어 ${i + 1} 캐릭터 & 닉네임
            </label>
            <div style="display: flex; gap: 6px;">
                <select class="animal-select" data-index="${i}" style="padding:6px; border:2px solid #e2e8f0; border-radius:6px; font-size:14px; background:#f8fafc;">
                    ${optionsHtml}
                </select>
                <input type="text" class="nickname-input" data-index="${i}" placeholder="플레이어 ${i + 1}" maxlength="10" style="flex:1; padding:6px; border:2px solid #e2e8f0; border-radius:6px; font-size:14px; text-align:center;">
            </div>
        `;
        container.appendChild(div);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    window.updateNicknameFields();
});

window.landUpgrades = {}; 
window.isUpgradeAttempt = false; 

window.initLocalGame = function () {
    const inputs = document.querySelectorAll('.nickname-input');
    const selects = document.querySelectorAll('.animal-select');
    
    if (inputs.length === 0) {
        alert('플레이어 정보를 입력해주세요.');
        return;
    }

    const tempPlayers = [];

    inputs.forEach((input, idx) => {
        let name = input.value.trim();
        if (!name) name = `플레이어 ${idx + 1}`;
        const animalIcon = selects[idx] ? selects[idx].value : '🐶';

        tempPlayers.push({
            pos: 0,
            score: 200,
            cards: 0,
            name: name,
            animal: animalIcon,
            colorIndex: idx,
            colorBg: PLAYER_COLORS[idx].bg,
            colorBorder: PLAYER_COLORS[idx].border
        });
    });

    window.players = tempPlayers;
    window.currentPlayer = 0;
    window.landOwnership = {};
    window.landUpgrades = {}; 
    window.skipPlayers = {};
    window.rolledDouble = false;

    window.gameMode = document.querySelector('input[name="gameMode"]:checked').value;

    if (window.gameMode === 'time') {
        window.timeLeft = (parseInt(document.getElementById('timeLimitInput').value) || 10) * 60;
        window.startTimer();
    } else {
        window.totalTurns = parseInt(document.getElementById('turnLimitInput').value) || 20;
        window.currentTurnCount = 1;
    }

    document.getElementById('startScreen').classList.add('hidden');
    
    window.createBoard();
    window.updateTokens();
    window.updateTurnUI();

    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) rollBtn.disabled = false;

    window.Synth.play('start');
};

window.createBoard = function () {
    const grid = document.getElementById('boardGrid');
    const existingCells = grid.querySelectorAll('.board-cell');
    existingCells.forEach(cell => cell.remove());

    window.boardData.forEach(cell => {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'board-cell';
        cellDiv.style.gridRow = cell.row;
        cellDiv.style.gridColumn = cell.col;
        cellDiv.id = `cell-${cell.id}`;
        cellDiv.innerHTML = `
            <div class="cell-category ${cell.catClass}">${cell.category}</div>
            <div class="cell-icon">${cell.icon}</div>
            <div class="cell-name">${cell.name}</div>
            <div class="token-container" id="tokens-${cell.id}"></div>
        `;
        grid.appendChild(cellDiv);
    });
};

window.updateCenterDisplay = function (cell) {
    const defaultDiv = document.getElementById('centerDefault');
    const landmarkDiv = document.getElementById('centerLandmark');

    if (!cell) {
        defaultDiv.style.display = 'block';
        landmarkDiv.style.display = 'none';
        return;
    }

    document.getElementById('centerImage').src = cell.img;
    document.getElementById('centerTitle').innerText = `${cell.icon} ${cell.name}`;
    document.getElementById('centerDesc').innerText = cell.desc;
    defaultDiv.style.display = 'none';
    landmarkDiv.style.display = 'flex';
};

window.updateTokens = function () {
    window.boardData.forEach(cell => {
        const container = document.getElementById(`tokens-${cell.id}`);
        if (container) container.innerHTML = '';
        const cellDiv = document.getElementById(`cell-${cell.id}`);
        
        const existingCrown = cellDiv?.querySelector('.crown-icon');
        if (existingCrown) existingCrown.remove();

        if (cellDiv) {
            cellDiv.classList.remove('highlight', 'owner-p1', 'owner-p2', 'owner-p3', 'owner-p4');
            const owner = window.landOwnership[cell.id];
            
            if (owner !== undefined) {
                cellDiv.classList.add(`owner-p${owner + 1}`);
                
                const upgradeLevel = window.landUpgrades[cell.id] || 0;
                if (upgradeLevel > 0) {
                    const crown = document.createElement('div');
                    crown.className = 'crown-icon';
                    crown.innerText = upgradeLevel === 2 ? '👑👑' : '👑';
                    crown.style.position = 'absolute';
                    crown.style.top = '-8px';
                    crown.style.right = '-4px';
                    crown.style.fontSize = '14px';
                    crown.style.zIndex = '20';
                    cellDiv.appendChild(crown);
                }
            }
        }
    });

    window.players.forEach((p, idx) => {
        if (!p || p.isEliminated) return;
        const container = document.getElementById(`tokens-${p.pos}`);
        if (container) {
            const token = document.createElement('div');
            token.className = `player-token`;
            token.innerText = p.animal;
            token.style.backgroundColor = p.colorBg;
            token.style.borderColor = p.colorBorder;
            container.appendChild(token);
        }
    });

    const currentPos = window.players[window.currentPlayer]?.pos;
    if (currentPos !== undefined) {
        const currentCellDiv = document.getElementById(`cell-${currentPos}`);
        if (currentCellDiv) currentCellDiv.classList.add('highlight');
    }

    const statusEl = document.getElementById('playerStatus');
    statusEl.innerHTML = '<div style="font-size:14px; font-weight:bold; color:#2563eb; margin-bottom:6px; text-align:center; padding-bottom:4px; border-bottom:2px dashed #93c5fd;">🏆 실시간 순위표</div>';
    
    const rankedPlayers = [...window.players]
        .map((p, idx) => ({ ...p, originalIdx: idx }))
        .sort((a, b) => (b.score - a.score) || (b.cards - a.cards));

    rankedPlayers.forEach((p, rank) => {
        if (!p) return;
        const isActive = (p.originalIdx === window.currentPlayer);
        const card = document.createElement('div');
        card.className = `player-card ${isActive ? 'active' : ''}`;

        let rankBadge = `${rank + 1}위`;
        if (rank === 0) rankBadge = '🥇';
        else if (rank === 1) rankBadge = '🥈';
        else if (rank === 2) rankBadge = '🥉';

        card.innerHTML = `
            <div class="player-header">
                <span>${rankBadge} <span style="background:${p.colorBg}; padding:2px 4px; border-radius:4px; border:1px solid ${p.colorBorder};">${p.animal} ${p.name}</span></span>
                <span>${window.boardData[p.pos]?.name || '출발'}</span>
            </div>
            <div class="player-score">자산: ${p.score}점 | 랜드마크: ${p.cards}개</div>
        `;
        statusEl.appendChild(card);
    });
};

window.updateTurnUI = function () {
    const badge = document.getElementById('turnBadge');
    const p = window.players[window.currentPlayer];
    if (badge) badge.innerText = p ? `${p.animal} ${p.name} 차례` : '대기 중';

    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) {
        rollBtn.disabled = false;
        rollBtn.innerText = "🎲 주사위 던지기";
    }

    const centerDiceBox = document.getElementById('centerDiceBox');
    if (centerDiceBox) centerDiceBox.innerText = '🎲 🎲';
    
    // 내 차례가 되면 현재 위치 장소 정보 표시
    if (p) {
        const currentCell = window.boardData[p.pos];
        window.updateCenterDisplay(currentCell);
    }

    if (window.updateGameStatusInfo) window.updateGameStatusInfo();
};

window.checkWinCondition = function () {
    const activePlayers = window.players.filter(p => p && !p.isEliminated);
    if (activePlayers.length <= 1) {
        window.showWinModal(0);
        return true;
    }
    return false;
};

window.showWinModal = function (winnerIdx) {
    const modal = document.getElementById('winModal');
    if (!modal || modal.style.display === 'flex') return;
    window.Synth.play('win');

    const winner = window.players[winnerIdx];
    document.getElementById('winTitle').innerText = '🎉 게임 종료!';
    document.getElementById('winMessage').innerText = `${winner.animal} ${winner.name}님이 우승하셨습니다!`;

    const rankingEl = document.getElementById('winRanking');
    rankingEl.innerHTML = '';
    [...window.players]
        .sort((a, b) => b.score - a.score)
        .forEach((p, rank) => {
            const row = document.createElement('div');
            row.className = 'win-rank-row';
            row.innerHTML = `${rank + 1}위 ${p.animal} ${p.name} — ${p.score}점`;
            rankingEl.appendChild(row);
        });

    modal.style.display = 'flex';
};

window.rollDice = function () {
    if (window.isMoving) return;

    // 주사위를 던질 때 현재 서 있는 위치의 정보 표시
    const p = window.players[window.currentPlayer];
    if (p) {
        const currentCell = window.boardData[p.pos];
        window.updateCenterDisplay(currentCell);
    }

    window.Synth.play('roll');

    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) rollBtn.disabled = true;

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const totalSteps = dice1 + dice2;
    window.rolledDouble = (dice1 === dice2);

    const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    let rollCount = 0;
    window.isMoving = true;

    const diceInterval = setInterval(() => {
        const r1 = Math.floor(Math.random() * 6) + 1;
        const r2 = Math.floor(Math.random() * 6) + 1;
        
        const centerDiceBox = document.getElementById('centerDiceBox');
        if (centerDiceBox) centerDiceBox.innerText = diceFaces[r1 - 1] + ' ' + diceFaces[r2 - 1];
        
        rollCount++;
        if (rollCount > 8) {
            clearInterval(diceInterval);
            if (centerDiceBox) centerDiceBox.innerText = diceFaces[dice1 - 1] + ' ' + diceFaces[dice2 - 1];
            if (rollBtn) rollBtn.innerText = `${totalSteps}칸 전진!`;

            setTimeout(() => window.movePlayer(totalSteps), 400);
        }
    }, 80);
};

window.movePlayer = function (steps) {
    let p = window.players[window.currentPlayer];
    let startPos = p.pos;
    let stepCount = 0;
    
    // movePlayer를 재귀적으로 호출할 때 방향 판별용
    const isBackward = steps < 0;
    const targetSteps = Math.abs(steps);

    const moveInterval = setInterval(() => {
        stepCount++;
        window.Synth.play('move');
        
        // 앞으로 갈지 뒤로 갈지에 따라 위치 계산
        if (isBackward) {
            startPos--;
            if (startPos < 0) startPos = window.boardData.length - 1;
        } else {
            startPos++;
            if (startPos >= window.boardData.length) startPos = 0;
        }
        
        const displayPos = startPos;
        const currentCell = window.boardData[displayPos];
        window.updateCenterDisplay(currentCell);
        
        if (!isBackward && displayPos === 0) p.score += 100; // 출발점 통과 보너스

        p.pos = displayPos;
        window.updateTokens();

        if (stepCount >= targetSteps) {
            clearInterval(moveInterval);
            setTimeout(() => {
                window.isMoving = false;
                window.handleCellLanding();
            }, 400);
        }
    }, 250);
};

window.handleCellLanding = function () {
    const p = window.players[window.currentPlayer];
    const currentCell = window.boardData[p.pos];
    
    if (currentCell.category === '특수공간' || currentCell.category === '이벤트') {
        window.handleSpecialSpace(currentCell);
        return;
    }
    
    const owner = window.landOwnership[p.pos];
    const upgradeLevel = window.landUpgrades[p.pos] || 0; 
    const cp = window.currentPlayer;
    
    if (owner !== undefined && owner !== cp) {
        let toll = upgradeLevel === 2 ? 200 : (upgradeLevel === 1 ? 100 : 50);
        p.score -= toll;
        window.players[owner].score += toll;
        window.updateTokens();
        if (window.checkWinCondition()) return;
        alert(`${currentCell.name}은(는) 다른 사람의 땅입니다! 통행료 ${toll}점 지불!`);
        window.nextTurn();
        return;
    }
    
    if (owner === cp) {
        if (upgradeLevel < 2 && currentCell.question) {
            window.isUpgradeAttempt = upgradeLevel + 1; 
            window.openQuizModal(currentCell, window.isUpgradeAttempt);
            return;
        } else {
            alert(`내 땅 [${currentCell.name}]입니다!`);
            window.nextTurn();
            return;
        }
    }
    
    if (owner === undefined && p.pos !== 0) {
        if (currentCell.question) {
            window.isUpgradeAttempt = 0; 
            window.openQuizModal(currentCell, 0);
        } else {
            window.landOwnership[p.pos] = cp; 
            window.updateTokens();
            window.nextTurn();
        }
    }
};

window.quizTimeout = null;
window.countdownInterval = null;

window.openQuizModal = function (cell, attemptLevel) {
    const modal = document.getElementById('quizModal');
    document.getElementById('modalCategory').innerText = attemptLevel > 0 ? '랜드마크 업그레이드' : cell.category;
    document.getElementById('modalTitle').innerText = cell.name;

    let qText = cell.question, qOpts = cell.options, qAns = cell.answer, qExp = cell.exp;
    if (attemptLevel === 1 && cell.question2) { qText = cell.question2; qOpts = cell.options2; qAns = cell.answer2; qExp = cell.exp2; }
    else if (attemptLevel === 2 && cell.question3) { qText = cell.question3; qOpts = cell.options3; qAns = cell.answer3; qExp = cell.exp3; }

    document.getElementById('modalQuestion').innerHTML = qText;
    const optionsContainer = document.getElementById('modalOptions');
    optionsContainer.innerHTML = '';
    
    qOpts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option-btn';
        btn.innerText = `${idx + 1}. ${opt}`;
        btn.onclick = () => window.checkAnswer(idx, qAns, qExp);
        optionsContainer.appendChild(btn);
    });

    document.getElementById('resultMsg').style.display = 'none';
    document.getElementById('btnNext').style.display = 'none';
    modal.style.display = 'flex';
};

window.closeQuizModal = function () {
    // 기존에 작동 중이던 타이머가 있다면 확실하게 제거하여 중복 호출 방지
    if (window.quizTimeout) {
        clearTimeout(window.quizTimeout);
        window.quizTimeout = null;
    }
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }

    document.getElementById('quizModal').style.display = 'none';
    window.nextTurn();
};

window.nextTurn = function () {
    const playerCount = window.players.length;
    if (playerCount === 0) return;

    if (window.rolledDouble) {
        window.rolledDouble = false;
        alert(`🎲 더블입니다! ${window.players[window.currentPlayer].animal} ${window.players[window.currentPlayer].name}님이 한 번 더 주사위를 던집니다!`);
    } else {
        const prevPlayer = window.currentPlayer;
        window.currentPlayer = (window.currentPlayer + 1) % playerCount;

        if (window.currentPlayer === 0 && prevPlayer !== 0) {
            if (window.gameMode === 'turn') {
                window.currentTurnCount++;
                if (window.currentTurnCount > window.totalTurns) {
                    alert("🔄 모든 턴이 종료되었습니다!");
                    window.showWinModal(0);
                    return;
                }
            }
        }
    }

    if (window.skipPlayers[window.currentPlayer] > 0) {
        window.skipPlayers[window.currentPlayer]--;
        alert(`🏝️ ${window.players[window.currentPlayer].name}님은 한 턴 쉬어갑니다!`);
        window.nextTurn();
        return;
    }

    window.updateGameStatusInfo();
    window.updateTokens();
    window.updateTurnUI(); 
};

window.checkAnswer = function (selected, correct, explanation) {
    const resultMsg = document.getElementById('resultMsg');
    const btnNext = document.getElementById('btnNext');
    document.querySelectorAll('.quiz-option-btn').forEach(btn => btn.disabled = true);

    const isCorrect = (selected === correct);
    const p = window.players[window.currentPlayer];

    if (isCorrect) {
        window.Synth.play('correct');
        resultMsg.className = 'result-msg correct';
        if (window.isUpgradeAttempt > 0) {
            window.landUpgrades[p.pos] = window.isUpgradeAttempt;
            resultMsg.innerText = `⭕ 정답입니다! 랜드마크가 업그레이드되었습니다!\n💡 ${explanation}`;
        } else {
            window.landOwnership[p.pos] = window.currentPlayer;
            p.score += 100;
            p.cards += 1;
            resultMsg.innerText = `⭕ 정답입니다! (+100점 / 땅 획득)\n💡 ${explanation}`;
        }
        window.updateTokens();
        if (window.checkWinCondition()) return;
    } else {
        window.Synth.play('wrong');
        resultMsg.className = 'result-msg wrong';
        resultMsg.innerText = `❌ 아쉽네요! 정답이 아닙니다.\n💡 ${explanation}`;
    }

    resultMsg.style.display = 'block';
    btnNext.style.display = 'block';

    // 기존 타이머 청소
    if (window.quizTimeout) clearTimeout(window.quizTimeout);
    if (window.countdownInterval) clearInterval(window.countdownInterval);

    let timeLeft = 3;
    btnNext.innerText = `${timeLeft}초 뒤 다음 사람으로 넘어갑니다...`;

    window.countdownInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            btnNext.innerText = `${timeLeft}초 뒤 다음 사람으로 넘어갑니다...`;
        } else {
            clearInterval(window.countdownInterval);
        }
    }, 1000);

    // 3초 후 자동 닫기
    window.quizTimeout = setTimeout(() => {
        window.closeQuizModal();
    }, 3000);
};

window.toggleModeSettings = function(mode) {
    document.getElementById('timeSettingBox').style.display = mode === 'time' ? 'block' : 'none';
    document.getElementById('turnSettingBox').style.display = mode === 'turn' ? 'block' : 'none';
};

window.startTimer = function() {
    window.timerInterval = setInterval(() => {
        window.timeLeft--;
        window.updateGameStatusInfo();
        if (window.timeLeft <= 0) {
            clearInterval(window.timerInterval);
            alert("⏰ 시간이 종료되었습니다!");
            window.showWinModal(0);
        }
    }, 1000);
};

window.updateGameStatusInfo = function() {
    const infoEl = document.getElementById('gameStatusInfo');
    if (!infoEl) return;
    if (window.gameMode === 'time') {
        const min = Math.floor(window.timeLeft / 60);
        const sec = window.timeLeft % 60;
        infoEl.innerHTML = `⏱️ 남은 시간: <span style="color: #e11d48;">${min}분 ${sec < 10 ? '0' : ''}${sec}초</span>`;
    } else {
        infoEl.innerHTML = `🔄 턴 제한: <span style="color: #2563eb;">${window.currentTurnCount} / ${window.totalTurns} 턴</span>`;
    }
};

/* ⚙️ 관리자 설정 (칸 이름 & 사진 주소 실시간 변경) */
window.openAdminModal = function() {
    const list = document.getElementById('adminImageList');
    list.innerHTML = '';
    
    window.boardData.forEach(cell => {
        const div = document.createElement('div');
        div.style.background = '#f8fafc';
        div.style.padding = '10px';
        div.style.borderRadius = '10px';
        div.style.border = '1px solid #e2e8f0';
        
        div.innerHTML = `
            <div style="font-size:12px; font-weight:800; color:#64748b; margin-bottom:6px;">칸 ID: ${cell.id}</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size:12px; font-weight:700; color:#1e293b;">칸 이름</label>
                <input type="text" id="adminName_${cell.id}" value="${cell.name}" style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
                
                ${cell.img ? `
                <label style="font-size:12px; font-weight:700; color:#1e293b; margin-top:4px;">사진 주소 (URL)</label>
                <input type="text" id="adminImg_${cell.id}" value="${cell.img}" style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
                ` : ''}
            </div>
        `;
        list.appendChild(div);
    });
    
    document.getElementById('adminModal').style.display = 'flex';
};

window.closeAdminModal = function() {
    document.getElementById('adminModal').style.display = 'none';
};

window.saveAdminSettings = function() {
    window.boardData.forEach(cell => {
        // 이름 변경 반영
        const nameInput = document.getElementById(`adminName_${cell.id}`);
        if (nameInput && nameInput.value.trim() !== '') {
            cell.name = nameInput.value.trim();
        }
        // 사진 주소 변경 반영
        const imgInput = document.getElementById(`adminImg_${cell.id}`);
        if (imgInput && imgInput.value.trim() !== '') {
            cell.img = imgInput.value.trim();
        }
    });

    // 변경된 이름과 사진으로 보드판 다시 그리기
    window.createBoard();
    window.updateTokens();
    
    alert('✅ 칸 이름과 사진 설정이 저장되어 보드판에 반영되었습니다!');
    window.closeAdminModal();
};