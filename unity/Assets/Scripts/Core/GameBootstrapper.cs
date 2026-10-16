using System.Collections.Generic;
using UnityEngine;
using NeonStrike.Audio;
using NeonStrike.Game;
using NeonStrike.Player;
using NeonStrike.VFX;
using NeonStrike.UI;

namespace NeonStrike.Core
{
    public class GameBootstrapper : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void AutoBootstrap()
        {
            if (FindFirstObjectByType<RhythmCombatManager>() != null) return;

            GameObject root = new GameObject("--- GAME BOOTSTRAP ---");

            // 1. Setup Camera
            Camera cam = Camera.main;
            if (cam == null)
            {
                GameObject camObj = new GameObject("Main Camera");
                cam = camObj.AddComponent<Camera>();
                cam.tag = "MainCamera";
            }
            cam.transform.position = new Vector3(0, 1.8f, -10f);
            cam.orthographic = true;
            cam.orthographicSize = 4.8f;
            cam.backgroundColor = new Color(0.04f, 0.05f, 0.09f); // Deep synthwave dark background
            cam.clearFlags = CameraClearFlags.SolidColor;

            if (cam.GetComponent<CameraShake>() == null)
            {
                cam.gameObject.AddComponent<CameraShake>();
            }

            // 2. Setup Audio Engine
            GameObject audioObj = new GameObject("AudioSyncEngine");
            audioObj.transform.SetParent(root.transform);
            AudioSyncEngine audioSync = audioObj.AddComponent<AudioSyncEngine>();

            // 3. Setup Conveyor Environment
            GameObject envObj = new GameObject("ConveyorEnvironment");
            envObj.transform.SetParent(root.transform);
            envObj.AddComponent<ConveyorEnvironment>();

            // 4. Setup Player
            GameObject playerObj = new GameObject("PlayerStickBrawler");
            playerObj.transform.SetParent(root.transform);
            playerObj.transform.position = Vector3.zero;
            PlayerCombatController player = playerObj.AddComponent<PlayerCombatController>();

            // 5. Setup Rhythm Combat Manager
            GameObject mgrObj = new GameObject("RhythmCombatManager");
            mgrObj.transform.SetParent(root.transform);
            RhythmCombatManager mgr = mgrObj.AddComponent<RhythmCombatManager>();

            // 6. Setup HUD
            GameObject hudObj = new GameObject("NeonHUD");
            hudObj.transform.SetParent(root.transform);
            hudObj.AddComponent<NeonHUD>();

            // 7. Load Audio Clips from Resources or search AudioClips in project
            AudioClip[] loadedClips = Resources.FindObjectsOfTypeAll<AudioClip>();
            List<TrackMetadata> tracks = new List<TrackMetadata>();

            // Register default tracks
            string[] defaultTitles = { "Eargasm", "Eargasm 2", "Eargasm 3", "Eargasm 4", "Eargasm 5" };
            float[] defaultBpms = { 150f, 150f, 150f, 200f, 136f };

            if (loadedClips != null && loadedClips.Length > 0)
            {
                for (int i = 0; i < loadedClips.Length; i++)
                {
                    var clip = loadedClips[i];
                    float bpm = (i < defaultBpms.Length) ? defaultBpms[i] : 150f;
                    tracks.Add(new TrackMetadata
                    {
                        id = "track_" + i,
                        title = clip.name,
                        artist = "defaultsaviour",
                        bpm = bpm,
                        difficulty = "Hard",
                        clip = clip
                    });
                }
            }

            if (tracks.Count > 0)
            {
                mgr.StartTrack(tracks[0]);
            }
        }
    }
}
