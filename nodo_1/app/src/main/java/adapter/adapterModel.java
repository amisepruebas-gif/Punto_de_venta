package adapter;


import static com.example.nodo_1.principal.jsonVenta;
import static adapterModel_package.recursos.comienzoMes;

import android.content.Context;
import android.graphics.Color;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.viewpager.widget.PagerAdapter;

import com.example.nodo_1.R;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.List;

import fragmentVenta.por_fecha;
import fragmentVenta.venta_clase;


public class adapterModel extends PagerAdapter {

    private List<Model> models;
    private LayoutInflater layoutInflater;
    private Context context;
    JSONObject jsonComienzoMes;
    por_fecha por_fecha;
    public adapterModel(List<Model> models,
                        Context context,
                        por_fecha por_fecha)
    {
        this.models         = models;
        this.context        = context;
        this.por_fecha    = por_fecha;
        jsonComienzoMes     = comienzoMes();
    }

    @Override
    public int getCount() {
        return models.size();
    }

    @Override
    public boolean isViewFromObject(@NonNull View view, @NonNull Object object) {
        return view.equals(object);
    }


    @NonNull
    @Override
    public Object instantiateItem(@NonNull ViewGroup container, final int position) {
        ventaXdia = 0;
        layoutInflater = LayoutInflater.from(context);
        View view = layoutInflater.inflate(R.layout.item, container, false);


        TextView fecha = view.findViewById(R.id.textView8_item);
        TextView ventaMes = view.findViewById(R.id.textView507);
        fecha.setText(models.get(position).getFecha());

        int dias = 0;
        try {
            dias = Integer.parseInt(
                    jsonComienzoMes.getString(models.get(position).getFecha().split(" ")[1]).split(",")[Integer.parseInt(models.get(position).getmes())-1]);
        } catch (JSONException e) {
            e.printStackTrace();
            toast("error 4");
        }

        int diascont = 1;

        for (int x = 0; x < dias; x++){
            int resourceId = context.getResources().getIdentifier("b_" + String.valueOf(diascont), "id", context.getPackageName());
            final Button button = view.findViewById(resourceId);
            button.setVisibility(View.INVISIBLE);
            diascont++;
        }
        // models.add(new Model(R.drawable.brochure, s,             cadenaIdBt,          null ,    menos_c(jsonVentaMes.names().getString(i).split("_")[1]),        list));
        // Model(              int image,          String fecha, String cadenaIdBut, Button button,                           String mes,                   ArrayList<String> list) {

        ArrayList<String> arrayList = models.get(position).getCadenaIdBut();

        if(dias != 0){
            int mesDias = 1;
            for (int i = 1; i <= 37; i++){
                if(i > dias){
                    if(mesDias <  (numeroDeDiasMes(
                            Integer.parseInt(models.get(position).getmes())) + 1)){

                        int resourceId      = context.getResources().getIdentifier("b_" + String.valueOf(i), "id", context.getPackageName());
                        int resourceIdVenta = context.getResources().getIdentifier("d_" + String.valueOf(i), "id", context.getPackageName());
                        final Button button = view.findViewById(resourceId);
                        button.setText(String.valueOf(mesDias));
                        if(i > 31)button.setVisibility(View.VISIBLE);
                        final TextView textView = (TextView)view.findViewById(resourceIdVenta);
                        if(arrayList.contains(String.valueOf(mesDias))){
                            textView.setVisibility(View.VISIBLE);
                            int ventaporDia = boton(button, position);
                            textView.setText("$"+comaACantidad(ventaporDia));
                            ventaXdia = ventaXdia + ventaporDia;
                        } else {
                            textView.setVisibility(View.GONE);
                            button.setTextColor(Color.GRAY);
                            button.setBackgroundResource(R.drawable.diasmayores);
                        }
                        mesDias++;
                    }else {
                        break;
                    }
                }
            }
        }
        else {
            for (int i = 1; i <= 31; i++){
                int resourceId      = context.getResources().getIdentifier("b_" + String.valueOf(i), "id", context.getPackageName());
                int resourceIdVenta = context.getResources().getIdentifier("d_" + String.valueOf(i), "id", context.getPackageName());
                final Button button = view.findViewById(resourceId);
                final TextView textView = (TextView)view.findViewById(resourceIdVenta);
                if(arrayList.contains(String.valueOf(i))){
                    textView.setVisibility(View.VISIBLE);
                    int ventaporDia = boton(button, position);
                    textView.setText("$"+comaACantidad(ventaporDia));
                    ventaXdia = ventaXdia + ventaporDia;
                } else {
                    textView.setVisibility(View.GONE);
                    button.setTextColor(Color.GRAY);
                    button.setBackgroundResource(R.drawable.diasmayores);
                }
            }
        }

        ventaMes.setText(comaACantidad(ventaXdia));

        container.addView(view, 0);
        return view;
    }

    int ventaXdia = 0;
    public void resetVentaXdiaF(){
        ventaXdia = 0;
    }

    public int boton(Button button, int position){
        button.setTextColor(Color.RED);
        button.setBackgroundResource(R.drawable.borderojo_y_fondoblanco);


        button.setClickable(true);
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                String dia = "";
                ArrayList<Integer> arrayList = new ArrayList<>();
                try {
                    dia =  button.getText().toString();
                    JSONArray arrayVenta =   jsonVenta.getJSONObject(models.get(position).getFecha().split(" ")[1]).//años
                            getJSONObject(models.get(position).getmes()).//meses
                            getJSONObject(dia).getJSONArray("registro");

                    int total_Cuenta = 0;
                    for (int i = 0; i < arrayVenta.length(); i ++){
                        try {
                            total_Cuenta = total_Cuenta + Integer.parseInt(arrayVenta.getJSONObject(i).getString("montoCobro"));
                        } catch (JSONException e) {
                            e.printStackTrace();
                        }
                    }

                    String diaMesAño = "", rastroFecha = "";
                    try {
                        String año = models.get(position).getFecha().split(" ")[1];
                        String mes = models.get(position).getmes();
                        diaMesAño =
                                arrayVenta.getJSONObject(0).getString("dia")
                                        + " " +
                                        arrayVenta.getJSONObject(0).
                                                getString("fecha").split(" ")[0] + "ç" +
                                        numeroAmes(models.get(position).getmes()) + "ç" +
                                        models.get(position).getFecha().split(" ")[1];

                        rastroFecha = año + " " + mes + " " + dia;

                        if(por_fecha !=null){
                            por_fecha.sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
                            por_fecha.actualizar(arrayVenta, diaMesAño, rastroFecha);
                        }
                    } catch (JSONException e) {
                        e.printStackTrace();
                        toast("error 1");
                    }
                } catch (JSONException e) {
                    e.printStackTrace();
                    toast("error 3 _-");

                }
            }
        });




        int ventaXdia = 0;
        ArrayList<JSONObject> arrayjson = new ArrayList<>();
        String s = "";
        ArrayList<Integer> arrayList = new ArrayList<>();
        try {
            s =  button.getText().toString();



            JSONArray ventaJSN =
                    jsonVenta.getJSONObject(models.get(position).getFecha().split(" ")[1]).//años
                            getJSONObject(models.get(position).getmes()).//meses
                            getJSONObject(s).
                            getJSONArray("registro");
            for (int u = 0; u < ventaJSN.length(); u++){
                if(ventaJSN.getJSONObject(u).has("montoCobro")){
                    ventaXdia = ventaXdia + Integer.parseInt(ventaJSN.getJSONObject(u).getString("montoCobro"));
                }else {
                    // notiene montoCobro porque se cobro con la tarjeta puntos
                    //toast(models.get(position).getFecha().split(" ")[1] + " " + models.get(position).getmes() + " " + s + " " + ventaJSN.names().getString(u));
                }
            }

        } catch (JSONException e) {
            e.printStackTrace();
            toast("error 3 a1");

        }

        return ventaXdia;
    }
    static public int numeroDeDiasMes(int mes){
        int numeroDias=-1;

        switch(mes){
            case 10:
            case 12:
            case 1:
            case 3:
            case 5:
            case 7:
            case 8:
                numeroDias=31;
                break;
            case 4:
            case 6:
            case 9:
            case 11:
                numeroDias=30;
                break;
            case 2:
                Date anioActual= new Date();
                if(esBisiesto(1900 + anioActual.getYear())){
                    numeroDias=29;
                }else{
                    numeroDias=28;
                }
                break;
        }
        return numeroDias;
    }
    public static boolean esBisiesto(int anio) {

        GregorianCalendar calendar = new GregorianCalendar();
        boolean esBisiesto = false;
        if (calendar.isLeapYear(anio)) {
            esBisiesto = true;
        }
        return esBisiesto;
    }
    private String dosDec(float valor){
        DecimalFormat format = new DecimalFormat();
        format.setMaximumFractionDigits(2); //Define 2 decimales.
        return format.format(valor);
    }
    void toast(String s){
        Toast toast = Toast.makeText(context, s, Toast.LENGTH_LONG);
        toast.setGravity(Gravity.CENTER_HORIZONTAL, 0, 0);
        toast.show();
    }

    @Override
    public void destroyItem(@NonNull ViewGroup container, int position, @NonNull Object object) {
        container.removeView((View)object);
    }
    String numeroAmes(String s){
        String a = "";
        switch (s){
            case "1":
                a = "Enero";
                break;
            case "2":
                a = "Febrero";
                break;
            case "3":
                a = "Marzo";
                break;
            case "4":
                a = "Abril";
                break;
            case "5":
                a = "Mayo";
                break;
            case "6":
                a = "Junio";
                break;
            case "7":
                a = "Julio";
                break;
            case "8":
                a = "Agosto";
                break;
            case "9":
                a = "Septiembre";
                break;
            case "10":
                a = "Otubre";
                break;
            case "11":
                a = "Noviembre";
                break;
            case "12":
                a = "Diciembre";
                break;
        }
        return a;
    }
    private String comaACantidad(int candidad){
        String venta = String.valueOf(candidad);

        if(venta.length() > 5) {//   $ 12,3456  $ 1,234
            venta = venta.substring(0,3) + "," + venta.substring(3);
        } else if(venta.length() > 4) {//   $ 12,3456  $ 1,234
            venta = venta.substring(0,2) + "," + venta.substring(2);
        } else if(venta.length() > 3){
            venta = venta.substring(0,1) + "," + venta.substring(1);
        }
        return venta;
    }
}
/*
grafica circulo
pieData.add(new SliceValue(acero, Color.BLUE).setLabel("ACERO: " + String.valueOf(dosDec(acero)) + "%"));
                        pieData.add(new SliceValue(accesorios, Color.GRAY).setLabel("ACCESORIOS: " + String.valueOf(dosDec(accesorios)) + "%"));
                        pieData.add(new SliceValue(anime, Color.RED).setLabel("ANIME: " + String.valueOf(dosDec(anime)) + "%"));
                        pieData.add(new SliceValue(papeleria, Color.YELLOW).setLabel("PAPELERIA: " + String.valueOf(dosDec(papeleria)) + "%"));
                        PieChartData pieChartData = new PieChartData(pieData);
                        pieChartData.setHasLabels(true);
                        //pieChartView.setPieChartData(pieChartData);


barras
int numColumns = 3;
  List<Column> columns = new ArrayList<Column>();
                        List<SubcolumnValue> values;

                        values = new ArrayList<SubcolumnValue>();
                        values.add(new SubcolumnValue(accesorios, Color.BLUE).setLabel("ACCESORIOS: " + String.valueOf(dosDec(accesorios)) + "%"));
                        values.add(new SubcolumnValue(anime, Color.GRAY).setLabel("ANIME: " + String.valueOf(dosDec(anime)) + "%"));
                        values.add(new SubcolumnValue(papeleria,Color.RED).setLabel("PAPELERIA: " + String.valueOf(dosDec(papeleria)) + "%"));
                        values.add(new SubcolumnValue(acero,Color.YELLOW).setLabel("ACERO: " + String.valueOf(dosDec(acero)) + "%"));

                        columns.add(new Column(values));

                        ColumnChartData data = new ColumnChartData(columns);
                        data.setAxisXBottom(new Axis().setName("Axis X").setHasTiltedLabels(true));
                        data.setAxisYLeft(new Axis().setName("Axis Y").setHasLines(true));
                        PreviewColumnChartView.setColumnChartData(data);

                        hellocharts-android/hellocharts-samples/src/lecho/lib/hellocharts/samples/ViewPagerChartsActivity.java /
 */