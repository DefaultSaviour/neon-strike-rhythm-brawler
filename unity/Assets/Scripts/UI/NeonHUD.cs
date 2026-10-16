using UnityEngine;
using NeonStrike.Core;
using NeonStrike.Game;
using NeonStrike.Audio;

namespace NeonStrike.UI
{
    public class NeonHUD : MonoBehaviour
    {
        [Header("Colors")]
        private readonly Color cyan = new Color(0f, 0.95f, 1f);
        private readonly Color pink = new Color(1f, 0.2f, 0.6f);
        private readonly Color amber = new Color(1f, 0.85f, 0.2f);
        private readonly Color subRed = new Color(1f, 0.15f, 0.3f);
        private readonly Color bassPurple = new Color(0.85f, 0.3f, 1f);
        private readonly Color highCyan = new Color(0.2f, 0.95f, 1f);

        private GUIStyle titleStyle;
        private GUIStyle comboStyle;
        private GUIStyle hudStyle;
        private GUIStyle legendStyle;
        private GUIStyle buttonStyle;

        private void OnGUI()
        {
            var manager = RhythmCombatManager.Instance;
            var audioSync = AudioSyncEngine.Instance;
            if (manager == null) return;

            InitStyles();

            float screenW = Screen.width;
            float screenH = Screen.height;

            // 1. Top Header Bar: Mode Toggle & Song Time
            GUILayout.BeginArea(new Rect(20, 15, screenW - 40, 50));
            GUILayout.BeginHorizontal();

            // One-Button Mode Toggle Button
            string modeText = manager.OneButtonMode ? "MODE: 1-BUTTON [SPACE / TAP]" : "MODE: 2-BUTTON [←/A] [→/D]";
            GUI.color = manager.OneButtonMode ? amber : cyan;
            if (GUILayout.Button(modeText, buttonStyle, GUILayout.Width(260), GUILayout.Height(34)))
            {
                manager.ToggleOneButtonMode();
            }

            GUILayout.FlexibleSpace();

            // Song Time
            if (audioSync != null && audioSync.SongDuration > 0)
            {
                float curTime = audioSync.GetSongTime();
                float totalTime = audioSync.SongDuration;
                GUI.color = Color.white;
                GUILayout.Label(string.Format("{0:00}:{1:00} / {2:00}:{3:00}",
                    (int)curTime / 60, (int)curTime % 60,
                    (int)totalTime / 60, (int)totalTime % 60), hudStyle);
            }

            GUILayout.EndHorizontal();
            GUILayout.EndArea();

            // 2. Frequency Band Legend
            GUILayout.BeginArea(new Rect(20, 60, screenW - 40, 30));
            GUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();

            GUI.color = subRed;
            GUILayout.Label("● Sub / Kick (36–145Hz)", legendStyle);
            GUILayout.Space(25);

            GUI.color = bassPurple;
            GUILayout.Label("● Bassline (105–300Hz)", legendStyle);
            GUILayout.Space(25);

            GUI.color = highCyan;
            GUILayout.Label("● Highs (800–6500Hz)", legendStyle);

            GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();
            GUILayout.EndArea();

            // 3. Center Left: Combo Counter
            if (manager.Combo > 0)
            {
                GUILayout.BeginArea(new Rect(40, 120, 300, 150));
                GUI.color = (manager.Combo >= 50) ? amber : (manager.Combo >= 16 ? cyan : pink);
                GUILayout.Label(manager.Combo + "x", comboStyle);
                GUILayout.Label("CHAIN COMBO", legendStyle);
                GUILayout.EndArea();
            }

            // 4. Center Right: Score & Accuracy & Grade
            GUILayout.BeginArea(new Rect(screenW - 280, 120, 240, 160));
            GUI.color = cyan;
            GUILayout.Label("SCORE: " + manager.Score.ToString("N0"), hudStyle);
            GUILayout.Label("ACCURACY: " + manager.GetAccuracy().ToString("F1") + "%", hudStyle);
            GUILayout.Label("GRADE: " + manager.GetGrade(), titleStyle);
            GUILayout.EndArea();

            // 5. Bottom Controls Bar
            GUILayout.BeginArea(new Rect(20, screenH - 45, screenW - 40, 35));
            GUILayout.BeginHorizontal();
            GUI.color = Color.gray;
            if (manager.OneButtonMode)
            {
                GUILayout.Label("Press [SPACE], [ENTER], or [CLICK] to strike automatically in the correct direction", legendStyle);
            }
            else
            {
                GUILayout.Label("Press [←] / [A] to Strike Left   |   Press [→] / [D] to Strike Right", legendStyle);
            }
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        private void InitStyles()
        {
            if (titleStyle == null)
            {
                titleStyle = new GUIStyle(GUI.skin.label)
                {
                    fontSize = 28,
                    fontStyle = FontStyle.Bold
                };
            }

            if (comboStyle == null)
            {
                comboStyle = new GUIStyle(GUI.skin.label)
                {
                    fontSize = 46,
                    fontStyle = FontStyle.Bold
                };
            }

            if (hudStyle == null)
            {
                hudStyle = new GUIStyle(GUI.skin.label)
                {
                    fontSize = 18,
                    fontStyle = FontStyle.Bold
                };
            }

            if (legendStyle == null)
            {
                legendStyle = new GUIStyle(GUI.skin.label)
                {
                    fontSize = 13,
                    fontStyle = FontStyle.Bold
                };
            }

            if (buttonStyle == null)
            {
                buttonStyle = new GUIStyle(GUI.skin.button)
                {
                    fontSize = 13,
                    fontStyle = FontStyle.Bold
                };
            }
        }
    }
}
