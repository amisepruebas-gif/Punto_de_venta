package adapterModel_package;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonCorteHistorial;
import static adapter.adapterModel.numeroDeDiasMes;
import static adapterModel_package.recursos.comienzoMes;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.viewpager.widget.PagerAdapter;


import com.example.nodo_1.R;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

import adapter.Model;

public class adap_model_fecha_venta_articulo extends PagerAdapter {
    JSONObject jsonComienzoMes;
    Context context;
    List<Model> models;
    String pz = "pz";
    public adap_model_fecha_venta_articulo(
            List<Model> models,
            Context context,
            adapter.adap_corte_1 adap_corte_1) {
        this.models = models;
        this.context = context;
        //this.adap_corte_1 = adap_corte_1;
        jsonComienzoMes = comienzoMes();
    }


    @SuppressLint("SetTextI18n")
    @NonNull
    @Override
    public Object instantiateItem(@NonNull ViewGroup container, final int position) {
        LayoutInflater layoutInflater;
        layoutInflater = LayoutInflater.from(context);
        View view = layoutInflater.inflate(R.layout.item, container, false);

        int dias = 0;
        try {
            dias = Integer.parseInt(
                    jsonComienzoMes.getString(models.get(position).getFecha().split(" ")[1]).split(",")[Integer.parseInt(models.get(position).getmes())-1]);
        } catch (JSONException e) {
            e.printStackTrace();
            toast("error 4", context);
        }
        int diascont = 1;
        for (int x = 0; x < dias; x++){
            int resourceId = context.getResources().getIdentifier("b_" + String.valueOf(diascont), "id", context.getPackageName());
            final Button button = view.findViewById(resourceId);
            button.setVisibility(View.INVISIBLE);
            diascont++;
        }
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
                            boton(button, position);
                            JSONObject object = models.get(position).getCantArt();
                            if(object.length() > 0){
                                if (object.has(String.valueOf(mesDias))){
                                    try {
                                        textView.setText(object.getString(String.valueOf(mesDias)) + pz);
                                    } catch (JSONException e) {
                                        throw new RuntimeException(e);
                                    }
                                }
                            }
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
                    boton(button, position);

                    JSONObject object = models.get(position).getCantArt();
                    if(object.length() > 0){
                        if (object.has(String.valueOf(i))){
                            try {
                                textView.setText(object.getString(String.valueOf(i)) + pz);
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    }
                } else {
                    textView.setVisibility(View.GONE);
                    button.setTextColor(Color.GRAY);
                    button.setBackgroundResource(R.drawable.diasmayores);
                }
            }
        }
        container.addView(view, 0);
        return view;
    }


    public void boton(Button button, int position){
        button.setTextColor(Color.RED);
        button.setBackgroundResource(R.drawable.borderojo_y_fondoblanco);


        button.setClickable(true);
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {

                ArrayList<Integer> arrayList = new ArrayList<>();
                String dia = button.getText().toString();
                String año = models.get(position).getFecha().split(" ")[1];
                String mes = models.get(position).getmes();

                //adap_corte_1.actualizar(initArray(año + "-" + mes + "-" + dia));
            }
        });
    }

    public static JSONArray obtenerRegistroPorFecha(String año, String mes, String dia) {
        try {
            return jsonCorteHistorial.getJSONObject(año).getJSONObject(mes).getJSONArray(dia);
        } catch (JSONException e) {
            // Manejar excepciones relacionadas con JSON
            e.printStackTrace();
            return null;
        }
    }
    @Override
    public int getCount() {
        return models.size();
    }

    @Override
    public boolean isViewFromObject(@NonNull View view, @NonNull Object object) {
        return view.equals(object);
    }
    @Override
    public void destroyItem(@NonNull ViewGroup container, int position, @NonNull Object object) {
        container.removeView((View)object);
    }

}
