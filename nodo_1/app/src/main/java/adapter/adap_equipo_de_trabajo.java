package adapter;

import static com.example.nodo_1.principal.jsonDatos;

import android.content.Context;
import android.graphics.drawable.Drawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.Switch;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.equipo_de_trabajo;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import de.hdodenhof.circleimageview.CircleImageView;
import helper.SwipeHelper;

public class adap_equipo_de_trabajo extends RecyclerView.Adapter<adap_equipo_de_trabajo.ViewHolder> {

    JSONArray array = new JSONArray();
    equipo_de_trabajo equipoDeTrabajo;
    ImageView imageViewAunNoHayElementos;
    Context context;
    SlidingUpPanelLayout sliding;

    public adap_equipo_de_trabajo(
            com.example.nodo_1.equipo_de_trabajo equipoDeTrabajo,
            ImageView imageViewAunNoHayElementos,
            Context context,
            SlidingUpPanelLayout sliding){
        this.context = context;
        this.equipoDeTrabajo = equipoDeTrabajo;
        this.imageViewAunNoHayElementos = imageViewAunNoHayElementos;
        this.sliding = sliding;
        init(false);
    }
    public void init(boolean init_){
        array = new JSONArray();
        if(jsonDatos.length() > 0){
            if(jsonDatos.has(context.getString(R.string.equipoDeTrabajo))){
                try {
                    llenarPrimeros_admin();
                    JSONObject obj = new JSONObject(jsonDatos.getJSONObject(context.getString(R.string.equipoDeTrabajo)).toString());
                    for (int y = 0; y < 2; y++){
                        for (int x = 0; x < obj.names().length(); x++){
                            if(!obj.names().getString(x).equals("huella")){
                                if(y==0){
                                    if(obj.getJSONObject(obj.names().getString(x)).has("admin"))array.put(obj.getJSONObject(obj.names().getString(x)));
                                } else {
                                    if(!obj.getJSONObject(obj.names().getString(x)).has("admin"))array.put(obj.getJSONObject(obj.names().getString(x)));
                                }
                            }
                        }
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }else {
                llenarPrimeros_admin();
            }
        }
        if (init_)notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.reg_equipo_de_trabajo, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        CircleImageView circleImageView = holder.circleImageView;
        Button butImagen = holder.butImagen, butInformacion = holder.butInformacion;
        TextView nombre = holder.nombre;
        CheckBox checkBoxStatus = holder.checkBoxStatus;
        Switch switch_aplicaCorte = holder.switch_aplicaCorte;
        ConstraintLayout consAdminEqp_trabajo = holder.consAdminEqp_trabajo;

        try {
            JSONObject object = array.getJSONObject(position);

            if(object.has("admin"))consAdminEqp_trabajo.setVisibility(View.VISIBLE);
            else consAdminEqp_trabajo.setVisibility(View.GONE);

            nombre.setText(object.getString("nombre"));
            Drawable drawable;
            if(object.has("icono")){
                int idDrawable = context.getResources().getIdentifier(object.getString("icono"), "drawable", context.getPackageName());
                if (idDrawable != 0) {
                    drawable = context.getResources().getDrawable(idDrawable, context.getTheme());
                    circleImageView.setImageDrawable(drawable);
                } else {
                }
            }else  {
                drawable = context.getResources().getDrawable(R.drawable.icon_persona, context.getTheme());
                circleImageView.setImageDrawable(drawable);
            }
            if(object.has("corte")){
                if(object.getString("corte").equals("1")) switch_aplicaCorte.setChecked(true);
                else  switch_aplicaCorte.setChecked(false);
            }else {
                switch_aplicaCorte.setChecked(false);
                object.put("corte", "0");
            }
            if(object.has("status")){
                if(object.getString("status").equals("1")) checkBoxStatus.setChecked(true);
                else  checkBoxStatus.setChecked(false);
            }else{
                checkBoxStatus.setChecked(false);
                if (object.has("nuevo")){
                    object.put("status", "1");
                    checkBoxStatus.setChecked(true);
                }
            }

            butImagen.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    sliding.setPanelState(SlidingUpPanelLayout.PanelState.EXPANDED);
                    equipoDeTrabajo.getIndexSeleccionImagen(holder.getAdapterPosition());
                }
            });
            butInformacion.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        equipoDeTrabajo.editarVerDatos(
                                holder.getAdapterPosition(),
                                array.getJSONObject(holder.getAdapterPosition()).getString("idUsuario"),
                                array.getJSONObject(holder.getAdapterPosition()));
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });
            checkBoxStatus.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        if(checkBoxStatus.isChecked()) array.getJSONObject(holder.getAdapterPosition()).put("status", "1");
                        else array.getJSONObject(holder.getAdapterPosition()).put("status", "0");
                        array.getJSONObject(holder.getAdapterPosition()).put("nuevo", "");
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });
            switch_aplicaCorte.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        if(switch_aplicaCorte.isChecked()){
                            array.getJSONObject(holder.getAdapterPosition()).put("corte", "1");
                        }else {
                            array.getJSONObject(holder.getAdapterPosition()).put("corte", "0");
                        }
                        array.getJSONObject(holder.getAdapterPosition()).put("nuevo", "");
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            });
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    public void getDrawableString(int index, String drawable) throws JSONException {
        array.getJSONObject(index).put("icono", drawable);
        array.getJSONObject(index).put("nuevo", "");
        notifyItemChanged(index);
        sliding.setPanelState(SlidingUpPanelLayout.PanelState.COLLAPSED);
    }
    public void add(JSONObject object){
        array.put(object);
        notifyItemInserted(array.length()-1);
    }
    public void actualizarDatosSinNotificiarAlAdaptador(int index, JSONObject object){
        try {
            for (int x = 0; x < object.names().length(); x++){
                array.getJSONObject(index).put(object.names().getString(x), object.getString(object.names().getString(x)));
            }
            array.getJSONObject(index).put("nuevo", "");
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    public JSONArray getArray(){return array;}
    @Override
    public int getItemCount() {
        if(array.length()>0)imageViewAunNoHayElementos.setVisibility(View.GONE);
        else imageViewAunNoHayElementos.setVisibility(View.VISIBLE);
        return array.length();
    }
    SwipeHelper swipeHelper = null;
    public void swip(SwipeHelper swipeHelper){
        this.swipeHelper = swipeHelper;
    }
    public void remove(int index){
        try {
            if(!array.getJSONObject(index).has("admin")){
                array.remove(index);
                notifyItemRemoved(index);
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }
    public class ViewHolder extends RecyclerView.ViewHolder {
        CircleImageView circleImageView;
        Button butImagen, butInformacion;
        TextView nombre;
        CheckBox checkBoxStatus;
        Switch switch_aplicaCorte;
        ConstraintLayout consAdminEqp_trabajo;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            butImagen               = (Button) itemView.findViewById(R.id.but_reg_equipo_de_trabajo);
            circleImageView         = (CircleImageView) itemView.findViewById(R.id.circleImageView_equipo_de_trabajo);
            nombre                  = (TextView) itemView.findViewById(R.id.nom_equipo_de_trabajo_reg);
            butInformacion          = (Button) itemView.findViewById(R.id.butInfo_equipo_de_trabajo);
            checkBoxStatus          = (CheckBox) itemView.findViewById(R.id.checkBoxStatus_re_equipo);
            switch_aplicaCorte      = (Switch) itemView.findViewById(R.id.switch_aplicaCorte);
            consAdminEqp_trabajo    = (ConstraintLayout) itemView.findViewById(R.id.consAdminEqp_trabajo);

        }
    }
    private void llenarPrimeros_admin(){
        try {
            JSONObject jsndmins = new JSONObject(jsonDatos.getJSONObject("dispositivos_mensaje").toString());
            for (int i = 0; i < jsndmins.names().length(); i ++){
                if(jsonDatos.has(context.getString(R.string.equipoDeTrabajo))){
                    if(!jsonDatos.getJSONObject(context.getString(R.string.equipoDeTrabajo)).has(jsndmins.names().getString(i))){
                        JSONObject obj =  jsndmins.getJSONObject(jsndmins.names().getString(i));
                        if (!obj.has("nodo")){
                            JSONObject object = new JSONObject();
                            object = obj;
                            object.put("idUsuario", jsndmins.names().getString(i));
                            object.put("nombre",    obj.getString("nameUser"));
                            object.put("admin", "");
                            array.put(object);
                        }
                    }
                }else {
                    JSONObject obj =  jsndmins.getJSONObject(jsndmins.names().getString(i));
                    if (!obj.has("nodo")){
                        JSONObject object = new JSONObject();
                        object = obj;
                        object.put("idUsuario", jsndmins.names().getString(i));
                        object.put("nombre",    obj.getString("nameUser"));
                        object.put("admin", "");
                        array.put(object);
                    }
                }
            }
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
}
