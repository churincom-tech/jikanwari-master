(function (global) {
  const App = global.TimetableApp = global.TimetableApp || {};
  const { uid } = App.State;

  function teacher(id, name, unavailable, partTime) {
    return {
      id,
      name,
      subjects: [],
      unavailable: unavailable || [],
      partTime: Boolean(partTime)
    };
  }

  function lesson(id, classId, subject, weeklyCount, teacherId, roomType, sameDayLimit, doubleMode) {
    const mode = doubleMode || "none";
    return {
      id,
      classId,
      subject,
      weeklyCount,
      teacherId,
      roomType: roomType || "普通教室",
      sameDayLimit: mode === "required" ? Math.max(sameDayLimit || 1, 2) : sameDayLimit || 1,
      allowDouble: mode !== "none",
      doubleMode: mode
    };
  }

  const STANDARD_WEEKLY_PLANS = {
    1: [
      ["国語", 4, "普通教室", 1, "none"],
      ["社会", 3, "普通教室", 1, "none"],
      ["数学", 4, "普通教室", 1, "none"],
      ["理科", 3, "理科室", 1, "none"],
      ["音楽", 1, "音楽室", 1, "none"],
      ["美術", 2, "美術室", 2, "required"],
      ["保体", 3, "体育館", 1, "none"],
      ["技術・家庭ブロック", 2, "分野教室", 2, "required"],
      ["英語", 4, "普通教室", 1, "none"],
      ["道徳", 1, "普通教室", 1, "none"],
      ["学活", 1, "普通教室", 1, "none"],
      ["総合", 1, "普通教室", 1, "none"]
    ],
    2: [
      ["国語", 4, "普通教室", 1, "none"],
      ["社会", 3, "普通教室", 1, "none"],
      ["数学", 3, "普通教室", 1, "none"],
      ["理科", 4, "理科室", 1, "none"],
      ["音楽", 1, "音楽室", 1, "none"],
      ["美術", 1, "美術室", 1, "none"],
      ["保体", 3, "体育館", 1, "none"],
      ["技術・家庭ブロック", 2, "分野教室", 2, "required"],
      ["英語", 4, "普通教室", 1, "none"],
      ["道徳", 1, "普通教室", 1, "none"],
      ["学活", 1, "普通教室", 1, "none"],
      ["総合", 2, "普通教室", 1, "none"]
    ],
    3: [
      ["国語", 3, "普通教室", 1, "none"],
      ["社会", 4, "普通教室", 1, "none"],
      ["数学", 4, "普通教室", 1, "none"],
      ["理科", 4, "理科室", 1, "none"],
      ["音楽", 1, "音楽室", 1, "none"],
      ["美術", 1, "美術室", 1, "none"],
      ["保体", 3, "体育館", 1, "none"],
      ["技術・家庭選択", 1, "分野教室", 1, "none"],
      ["英語", 4, "普通教室", 1, "none"],
      ["道徳", 1, "普通教室", 1, "none"],
      ["学活", 1, "普通教室", 1, "none"],
      ["総合", 2, "普通教室", 1, "none"]
    ]
  };

  function createSampleState() {
    const state = App.State.createBlankState();
    state.school = {
      name: "サンプル中学校",
      days: ["月", "火", "水", "木", "金"],
      periodsPerDay: 6,
      dayPeriodLimits: { "月": 6, "火": 6, "水": 6, "木": 6, "金": 6, "土": 4 },
      gradeCount: 3,
      classCounts: [2, 2, 2]
    };

    state.teachers = [
      teacher("t-jp1", "国語A", ["水-6"], false),
      teacher("t-jp2", "国語B", [], false),
      teacher("t-math1", "数学A", ["月-6"], false),
      teacher("t-math2", "数学B", [], false),
      teacher("t-eng1", "英語A", ["金-6"], false),
      teacher("t-eng2", "英語B", [], false),
      teacher("t-sci1", "理科A", ["火-6"], false),
      teacher("t-sci2", "理科B", [], false),
      teacher("t-soc1", "社会A", [], false),
      teacher("t-soc2", "社会B", ["金-6"], false),
      teacher("t-pe1", "保体A", [], false),
      teacher("t-pe2", "保体B", [], false),
      teacher("t-music", "音楽", ["木-5", "木-6"], true),
      teacher("t-art", "美術", [], true),
      teacher("t-tech", "技術", ["金-1"], true),
      teacher("t-home", "家庭科", [], true),
      teacher("t-integrated", "総合", [], false)
    ];

    App.State.getClasses(state).forEach((klass) => {
      state.teachers.push(teacher(`t-hr-${klass.id}`, `担任${klass.name}`, [], false));
    });

    state.rooms = [
      { id: "room-normal", name: "普通教室", type: "普通教室", count: 99 },
      { id: "room-science", name: "理科室", type: "理科室", count: 1 },
      { id: "room-gym", name: "体育館", type: "体育館", count: 1 },
      { id: "room-music", name: "音楽室", type: "音楽室", count: 1 },
      { id: "room-art", name: "美術室", type: "美術室", count: 1 },
      { id: "room-tech", name: "技術室", type: "技術室", count: 1 },
      { id: "room-home", name: "家庭科室", type: "家庭科室", count: 1 }
    ];

    const classes = App.State.getClasses(state);
    const lessons = [];
    const teacherPair = {
      "国語": ["t-jp1", "t-jp2"],
      "数学": ["t-math1", "t-math2"],
      "英語": ["t-eng1", "t-eng2"],
      "理科": ["t-sci1", "t-sci2"],
      "社会": ["t-soc1", "t-soc2"],
      "保体": ["t-pe1", "t-pe2"]
    };
    classes.forEach((klass, index) => {
      const pairIndex = index % 2;
      const teacherBySubject = {
        "国語": teacherPair["国語"][pairIndex],
        "数学": teacherPair["数学"][pairIndex],
        "英語": teacherPair["英語"][pairIndex],
        "理科": teacherPair["理科"][pairIndex],
        "社会": teacherPair["社会"][pairIndex],
        "保体": teacherPair["保体"][pairIndex],
        "音楽": "t-music",
        "美術": "t-art",
        "技術": "t-tech",
        "家庭科": "t-home",
        "総合": "t-integrated",
        "道徳": `t-hr-${klass.id}`,
        "学活": `t-hr-${klass.id}`
      };
      STANDARD_WEEKLY_PLANS[klass.grade].forEach(([subject, weeklyCount, roomType, sameDayLimit, doubleMode]) => {
        const isTechHomeChoice = subject === "技術・家庭選択";
        const isTechHomeBlock = subject === "技術・家庭ブロック";
        const isTechHome = isTechHomeChoice || isTechHomeBlock;
        const subjectName = isTechHome
          ? ((klass.grade + index) % 2 === 0 ? "技術" : "家庭科")
          : subject;
        const actualRoomType = isTechHome
          ? (subjectName === "技術" ? "技術室" : "家庭科室")
          : roomType;
        const actualTeacherId = isTechHome
          ? (subjectName === "技術" ? "t-tech" : "t-home")
          : teacherBySubject[subjectName];
        lessons.push(lesson(
          `lesson-${klass.id}-${subjectName}`,
          klass.id,
          subjectName,
          weeklyCount,
          actualTeacherId,
          actualRoomType,
          sameDayLimit,
          doubleMode
        ));
      });
    });
    state.lessons = lessons;

    state.fixedAssignments = classes.map((klass) => {
      const homeroom = lessons.find((item) => item.classId === klass.id && item.subject === "学活");
      return {
        id: `fixed-hr-${klass.id}`,
        classId: klass.id,
        day: "月",
        period: 1,
        lessonId: homeroom ? homeroom.id : "",
        teacherId: homeroom ? homeroom.teacherId : "",
        roomType: "普通教室"
      };
    });

    return state;
  }

  App.SampleData = {
    createSampleState
  };
})(globalThis);
