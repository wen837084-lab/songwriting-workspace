import { getAllLearningStageContent } from "../../domain/learning/learning";

export function LearningLibrary() {
  const entries = getAllLearningStageContent();

  return (
    <section className="learning-library" aria-labelledby="learning-library-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Workspace 学习</p>
          <h2 id="learning-library-heading">浏览现有学习主题</h2>
        </div>
        <p>与 Project 学习辅助共享的静态指导内容。</p>
      </div>

      <div className="learning-library-list">
        {entries.map((entry) => (
          <details className="learning-library-entry" key={entry.stage}>
            <summary>
              <span>{entry.stageLabel}</span>
              <span>{entry.focus}</span>
            </summary>
            <div className="learning-library-layers">
              <article>
                <p className="eyebrow">快速理解</p>
                <h3>{entry.quickUnderstanding.title}</h3>
                <p>{entry.quickUnderstanding.summary}</p>
                <ul>{entry.quickUnderstanding.points.map((point) => <li key={point}>{point}</li>)}</ul>
              </article>
              <article>
                <p className="eyebrow">练习</p>
                <h3>{entry.practice.title}</h3>
                <p>{entry.practice.summary}</p>
                <ul>{entry.practice.points.map((point) => <li key={point}>{point}</li>)}</ul>
              </article>
              <article>
                <p className="eyebrow">深入学习</p>
                <h3>{entry.deeperLearning.title}</h3>
                <p>{entry.deeperLearning.summary}</p>
                <ul>{entry.deeperLearning.points.map((point) => <li key={point}>{point}</li>)}</ul>
              </article>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
