package adapterModel_package;

import org.json.JSONException;
import org.json.JSONObject;

public class recursos {
    static public JSONObject comienzoMes(){
        JSONObject jsonComienzoMes = new JSONObject();
        try {
            jsonComienzoMes.put("2021", "5,1,1,4,6,2,4,0,3,5,1,3");
            jsonComienzoMes.put("2022", "6,2,2,5,0,3,5,1,4,6,2,4");
            jsonComienzoMes.put("2023", "0,3,3,6,1,4,6,2,5,0,3,5");
            jsonComienzoMes.put("2024", "1,4,5,1,3,6,1,4,0,2,5,0");
            jsonComienzoMes.put("2025", "3,6,6,2,4,0,2,5,1,3,6,1");
            jsonComienzoMes.put("2026", "4,0,0,3,5,1,3,6,2,4,0,2");
        } catch (JSONException e) {
            e.printStackTrace();
        }
        return jsonComienzoMes;
    }
}
