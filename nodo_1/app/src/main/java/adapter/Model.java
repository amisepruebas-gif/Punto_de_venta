package adapter;

import android.widget.Button;

import org.json.JSONObject;

import java.util.ArrayList;

public class Model {

    private Button button;
    private int image;
    private String fecha;
    private ArrayList<String> cadenaIdBut;
    private String mes;
    private ArrayList<String> list;
    JSONObject cantArt;

    public Model(int image, String fecha, ArrayList<String> cadenaIdBut, Button button, String mes, ArrayList<String> list, JSONObject cantArt) {
        this.list = list;
        this.button = button;
        this.image = image;
        this.fecha = fecha;
        this.cadenaIdBut = cadenaIdBut;
        this.mes = mes;
        this.cantArt = cantArt;
    }


    public Button getButton(){return button;}
    public void setButton(Button button){this.button = button;};

    public JSONObject getCantArt() { return cantArt; }

    public String getFecha() { return fecha; }

    public String getmes() { return mes; }

    public ArrayList<String> getCadenaIdBut() {
        return cadenaIdBut;
    }
}
