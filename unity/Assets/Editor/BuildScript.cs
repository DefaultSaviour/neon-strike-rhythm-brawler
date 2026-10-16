using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using NeonStrike.Core;
using NeonStrike.Audio;
using NeonStrike.Game;
using NeonStrike.Player;
using NeonStrike.VFX;
using NeonStrike.UI;

namespace NeonStrike.EditorScripts
{
    public static class BuildScript
    {
        private const string ScenePath = "Assets/Scenes/MainCombatScene.unity";

        [MenuItem("Neon Strike/Setup Scene")]
        public static void SetupMainScene()
        {
            if (!Directory.Exists("Assets/Scenes"))
            {
                Directory.CreateDirectory("Assets/Scenes");
            }

            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            // 1. Camera
            GameObject camObj = new GameObject("Main Camera");
            Camera cam = camObj.AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.orthographic = true;
            cam.orthographicSize = 4.8f;
            cam.backgroundColor = new Color(0.04f, 0.05f, 0.09f);
            cam.clearFlags = CameraClearFlags.SolidColor;
            camObj.transform.position = new Vector3(0, 1.8f, -10f);
            camObj.AddComponent<CameraShake>();

            // 2. Audio Engine
            GameObject audioObj = new GameObject("AudioSyncEngine");
            AudioSyncEngine audioSync = audioObj.AddComponent<AudioSyncEngine>();

            // 3. Conveyor Environment
            GameObject envObj = new GameObject("ConveyorEnvironment");
            envObj.AddComponent<ConveyorEnvironment>();

            // 4. Player
            GameObject playerObj = new GameObject("PlayerStickBrawler");
            playerObj.transform.position = Vector3.zero;
            PlayerCombatController player = playerObj.AddComponent<PlayerCombatController>();

            // 5. Rhythm Combat Manager
            GameObject mgrObj = new GameObject("RhythmCombatManager");
            RhythmCombatManager mgr = mgrObj.AddComponent<RhythmCombatManager>();

            // Assign references via SerializedObject
            SerializedObject soMgr = new SerializedObject(mgr);
            soMgr.FindProperty("player").objectReferenceValue = player;
            soMgr.FindProperty("audioSync").objectReferenceValue = audioSync;

            // Load and assign audio tracks
            SerializedProperty tracksProp = soMgr.FindProperty("availableTracks");
            string[] trackGuids = AssetDatabase.FindAssets("t:AudioClip", new[] { "Assets/Audio/Tracks" });
            tracksProp.ClearArray();

            string[] defaultTitles = { "Eargasm", "Eargasm 2", "Eargasm 3", "Eargasm 4", "Eargasm 5" };
            float[] defaultBpms = { 150f, 150f, 150f, 200f, 136f };

            for (int i = 0; i < trackGuids.Length; i++)
            {
                string assetPath = AssetDatabase.GUIDToAssetPath(trackGuids[i]);
                AudioClip clip = AssetDatabase.LoadAssetAtPath<AudioClip>(assetPath);
                if (clip == null) continue;

                tracksProp.InsertArrayElementAtIndex(tracksProp.arraySize);
                SerializedProperty item = tracksProp.GetArrayElementAtIndex(tracksProp.arraySize - 1);

                float bpm = (i < defaultBpms.Length) ? defaultBpms[i] : 150f;
                string title = (i < defaultTitles.Length) ? defaultTitles[i] : clip.name;

                item.FindPropertyRelative("id").stringValue = "track_" + i;
                item.FindPropertyRelative("title").stringValue = title;
                item.FindPropertyRelative("artist").stringValue = "defaultsaviour";
                item.FindPropertyRelative("bpm").floatValue = bpm;
                item.FindPropertyRelative("difficulty").stringValue = "Hard";
                item.FindPropertyRelative("clip").objectReferenceValue = clip;
            }

            soMgr.ApplyModifiedProperties();

            // 6. HUD
            GameObject hudObj = new GameObject("NeonHUD");
            hudObj.AddComponent<NeonHUD>();

            // Save Scene
            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();

            // Add Scene to Build Settings
            EditorBuildSettingsScene[] buildScenes = new EditorBuildSettingsScene[]
            {
                new EditorBuildSettingsScene(ScenePath, true)
            };
            EditorBuildSettings.scenes = buildScenes;

            Debug.Log("[Neon Strike] MainCombatScene created and added to Build Settings successfully!");
        }

        public static void BuildWebGL()
        {
            SetupMainScene();

            string buildPath = Path.GetFullPath(Path.Combine(Application.dataPath, "../../dist_unity_webgl"));
            if (!Directory.Exists(buildPath))
            {
                Directory.CreateDirectory(buildPath);
            }

            // Configure WebGL player settings
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled; // Fast local loading
            PlayerSettings.WebGL.memorySize = 256;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.FullWithStacktrace;

            BuildPlayerOptions options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = buildPath,
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            };

            Debug.Log("[Neon Strike] Starting WebGL Build to: " + buildPath);
            var report = BuildPipeline.BuildPlayer(options);
            Debug.Log("[Neon Strike] WebGL Build Result: " + report.summary.result);

            if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                throw new Exception("WebGL Build Failed: " + report.summary.result);
            }
        }

        public static void BuildWindowsStandalone()
        {
            SetupMainScene();

            string buildDir = Path.GetFullPath(Path.Combine(Application.dataPath, "../../dist_unity_windows"));
            if (!Directory.Exists(buildDir))
            {
                Directory.CreateDirectory(buildDir);
            }
            string exePath = Path.Combine(buildDir, "NeonStrike.exe");

            BuildPlayerOptions options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = exePath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None
            };

            Debug.Log("[Neon Strike] Starting Windows Standalone Build to: " + exePath);
            var report = BuildPipeline.BuildPlayer(options);
            Debug.Log("[Neon Strike] Windows Build Result: " + report.summary.result);

            if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                throw new Exception("Windows Build Failed: " + report.summary.result);
            }
        }
    }
}
