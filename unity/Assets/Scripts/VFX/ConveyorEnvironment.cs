using UnityEngine;

namespace NeonStrike.VFX
{
    public class ConveyorEnvironment : MonoBehaviour
    {
        [Header("Conveyor Settings")]
        [SerializeField] private float conveyorLength = 16f;
        [SerializeField] private Color groundColor = new Color(0.1f, 0.4f, 0.8f, 0.7f);
        [SerializeField] private Color centerZoneColor = new Color(0f, 0.95f, 1f, 0.9f);

        private LineRenderer groundLine;
        private LineRenderer centerTarget;

        private void Awake()
        {
            SetupConveyorVisuals();
        }

        private void SetupConveyorVisuals()
        {
            // Ground line
            GameObject groundObj = new GameObject("GroundLine");
            groundObj.transform.SetParent(transform, false);
            groundLine = groundObj.AddComponent<LineRenderer>();
            groundLine.useWorldSpace = false;
            groundLine.startWidth = 0.08f;
            groundLine.endWidth = 0.08f;
            groundLine.material = CreateMaterial(groundColor);

            groundLine.positionCount = 2;
            groundLine.SetPositions(new Vector3[]
            {
                new Vector3(-conveyorLength, 0f, 0f),
                new Vector3(conveyorLength, 0f, 0f)
            });

            // Center strike zone indicator
            GameObject centerObj = new GameObject("CenterZone");
            centerObj.transform.SetParent(transform, false);
            centerTarget = centerObj.AddComponent<LineRenderer>();
            centerTarget.useWorldSpace = false;
            centerTarget.startWidth = 0.06f;
            centerTarget.endWidth = 0.06f;
            centerTarget.loop = true;
            centerTarget.material = CreateMaterial(centerZoneColor);

            int segments = 20;
            Vector3[] circlePoints = new Vector3[segments];
            float radius = 0.5f;
            for (int i = 0; i < segments; i++)
            {
                float rad = (i / (float)segments) * Mathf.PI * 2f;
                circlePoints[i] = new Vector3(Mathf.Cos(rad) * radius, Mathf.Sin(rad) * 0.18f, 0);
            }
            centerTarget.positionCount = segments;
            centerTarget.SetPositions(circlePoints);
        }

        private Material CreateMaterial(Color color)
        {
            Shader shader = Shader.Find("Sprites/Default");
            if (shader == null) shader = Shader.Find("Unlit/Color");
            Material mat = new Material(shader);
            mat.color = color;
            return mat;
        }
    }
}
