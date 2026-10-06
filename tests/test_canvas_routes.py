def test_canvas_routes(test_env):
    client, _temp_dir = test_env

    # 1. Create a project
    res = client.post("/api/projects", json={"title": "Design System"})
    assert res.status_code == 201

    # 2. List canvases initially - empty
    res = client.get("/api/projects/design-system/canvas")
    assert res.status_code == 200
    assert res.json() == []

    # 3. Get non-existent canvas returns 404
    res = client.get("/api/projects/design-system/canvas/unknown")
    assert res.status_code == 404

    # 4. Get default/main canvas when not present returns empty doc
    res = client.get("/api/projects/design-system/canvas/main")
    assert res.status_code == 200
    assert res.json()["nodes"] == []
    assert res.json()["edges"] == []

    # 5. Save canvas document
    canvas_doc = {
        "nodes": [
            {
                "id": "node-1",
                "type": "text",
                "text": "Hello world",
                "x": 100,
                "y": 150,
                "width": 200,
                "height": 100,
            }
        ],
        "edges": [
            {
                "id": "edge-1",
                "fromNode": "node-1",
                "fromSide": "right",
                "toNode": "node-2",
                "toSide": "left",
                "color": "#3b82f6",
            }
        ],
    }
    res = client.put("/api/projects/design-system/canvas/sprint-1", json=canvas_doc)
    assert res.status_code == 200
    saved = res.json()
    assert len(saved["nodes"]) == 1
    assert len(saved["edges"]) == 1

    # 6. List canvases now returns sprint-1
    res = client.get("/api/projects/design-system/canvas")
    assert res.status_code == 200
    canvases = res.json()
    assert len(canvases) == 1
    assert canvases[0]["id"] == "sprint-1"

    # 7. Get canvas sprint-1
    res = client.get("/api/projects/design-system/canvas/sprint-1")
    assert res.status_code == 200
    assert res.json()["nodes"][0]["text"] == "Hello world"

    # 8. Delete canvas
    res = client.delete("/api/projects/design-system/canvas/sprint-1")
    assert res.status_code == 204

    # 9. Verify deleted
    res = client.get("/api/projects/design-system/canvas")
    assert res.status_code == 200
    assert res.json() == []
