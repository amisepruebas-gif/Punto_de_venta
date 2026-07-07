package adapter;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class adap_mensajes extends RecyclerView.Adapter<adap_mensajes.ViewHolder> {

    Context context;
    String idDispositivo;
    JSONArray array = new JSONArray();
    pop.pop_mensajes pop_mensajes;
    public adap_mensajes(JSONArray array, Context context, pop.pop_mensajes pop_mensajes){
        this.array          = array;
        this.context        = context;
        this.pop_mensajes   = pop_mensajes;
        idDispositivo   = generales.loadData_sharedPreferences(context, "id_mensaje", "dispositivo");
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.registro_mensajes, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        ConstraintLayout cons_1 = holder.cons_1, cons_2 = holder.cons_2;
        ConstraintLayout consMensajeIntermedio = holder.consMensajeIntermedio;

        TextView textView_user_1 = holder.textView_user_1, textView_user_2 = holder.textView_user_2;
        TextView user_1 = holder.user_1, user_2 = holder.user_2;
        TextView hora_user_1 = holder.hora_user_1, hora_user_2 = holder.hora_user_2;

        Button but_verMensajesAnteriores = holder.verMensajesAnteriores;
        ImageView imageView_User_1 = holder.imageView_User_1, imageView_User_2 = holder.imageView_User_2;

        consMensajeIntermedio       .setVisibility(View.GONE);
        but_verMensajesAnteriores   .setVisibility(View.GONE);


        ImageView imgMedia_1 = holder.imgMedia_user_1, imgMedia_2 = holder.imgMedia_user_2;
        imgMedia_1.setVisibility(View.GONE);
        imgMedia_2.setVisibility(View.GONE);

        try {
            if(array.getJSONObject(position).getString("id").equals(idDispositivo)){
                cons_1.setVisibility(View.VISIBLE);
                cons_2.setVisibility(View.GONE);
                ConstraintLayout replyConsUser_1 = holder.replyConsUser_1;
                /**USUARIO PRINCIPAL    USUARIO 1       **/

                cons_1.setVisibility(View.VISIBLE); cons_2.setVisibility(View.GONE);
                user_1.setText(         array.getJSONObject(position).getString("usuario"));
                textView_user_1.setText(array.getJSONObject(position).getString("texto"));
                hora_user_1.setText(    array.getJSONObject(position).getString("hora").split(" ")[1]);

                if(array.getJSONObject(position).has("tipo") && !array.getJSONObject(position).getString("tipo").equals("texto")){
                    imgMedia_1.setVisibility(View.VISIBLE);
                    String url = array.getJSONObject(position).getString("mediaUrl");
                    if(array.getJSONObject(position).getString("tipo").equals("gif")){
                        Glide.with(context).asGif().load(url).into(imgMedia_1);
                    } else {
                        Glide.with(context).load(url).into(imgMedia_1);
                    }
                    if(array.getJSONObject(position).getString("texto").isEmpty()){
                        textView_user_1.setVisibility(View.GONE);
                    } else {
                        textView_user_1.setVisibility(View.VISIBLE);
                    }
                } else {
                    imgMedia_1.setVisibility(View.GONE);
                    textView_user_1.setVisibility(View.VISIBLE);
                }

                if (array.getJSONObject(position).getString("usuario").equals("Jesús")){
                    imageView_User_1.setImageResource(R.drawable.avatar_1);
                }else if (array.getJSONObject(position).getString("usuario").equals("Valeria")){
                    imageView_User_1.setImageResource(R.drawable.avatar_3);
                }else {
                    imageView_User_1.setImageResource(R.drawable.avatar_2);
                }
                if(array.getJSONObject(position).has("corte")){
                    textView_user_1.setGravity(Gravity.LEFT);
                }else textView_user_1.setGravity(Gravity.RIGHT);

               /*
                if(array.getJSONObject(position).has("corte")
                        &&
                        !array.getJSONObject(position).getString("maquina").equals("1")
                        &&
                        !array.getJSONObject(position).getString("maquina").equals("2")){
                    if(!generales.getAnñoMesDiaHora("dia").equals(
                            (array.getJSONObject(position).getString("hora").split(" ")[0]).split("-")[2])){
                        textView_user_1.setText("CORTE CORRECTAMENTE REGISTRADO");
                    }
                }else{textView_user_1.setText(array.getJSONObject(position).getString("texto"));}

                */

                if (array.getJSONObject(position).has("reply")){
                    replyConsUser_1.setVisibility(View.VISIBLE);
                    TextView replyEncabezado_user_1 = holder.replyEncabezado_user_1,
                            replyTexto_User_1 = holder.replyTexto_User_1;
                    replyEncabezado_user_1.setText(array.getJSONObject(position).getString("replyEncabezado"));
                    replyTexto_User_1.setText(array.getJSONObject(position).getString("replyTexto"));
                }else {
                    replyConsUser_1.setVisibility(View.GONE);
                }
            }else {
                cons_2.setVisibility(View.VISIBLE);
                cons_1.setVisibility(View.GONE);
                /**USUARIO PRINCIPAL    USUARIO 2       **/

                ConstraintLayout replyConsUser_2 = holder.replyConsUser_2;


                if (array.getJSONObject(position).getString("usuario").equals("Jesús")){
                    imageView_User_2.setImageResource(R.drawable.avatar_1);
                }else if (array.getJSONObject(position).getString("usuario").equals("Valeria")){
                    imageView_User_2.setImageResource(R.drawable.avatar_3);
                }else {
                    imageView_User_2.setImageResource(R.drawable.avatar_2);
                }
                if (array.getJSONObject(position).has("reply")){
                    replyConsUser_2.setVisibility(View.VISIBLE);
                    TextView replyEncabezado_user_2 = holder.replyEncabezado_user_2,
                            replyTexto_User_2 = holder.replyTexto_User_2;
                    replyEncabezado_user_2.setText(array.getJSONObject(position).getString("replyEncabezado"));
                    replyTexto_User_2.setText(array.getJSONObject(position).getString("replyTexto"));
                }else {
                    replyConsUser_2.setVisibility(View.GONE);
                }

                cons_1.setVisibility(View.GONE); cons_2.setVisibility(View.VISIBLE);
                user_2.setText(         array.getJSONObject(position).getString("usuario"));
                textView_user_2.setText(array.getJSONObject(position).getString("texto"));
                hora_user_2.setText(    array.getJSONObject(position).getString("hora").split(" ")[1]);

                if(array.getJSONObject(position).has("tipo") && !array.getJSONObject(position).getString("tipo").equals("texto")){
                    imgMedia_2.setVisibility(View.VISIBLE);
                    String url = array.getJSONObject(position).getString("mediaUrl");
                    if(array.getJSONObject(position).getString("tipo").equals("gif")){
                        Glide.with(context).asGif().load(url).into(imgMedia_2);
                    } else {
                        Glide.with(context).load(url).into(imgMedia_2);
                    }
                    if(array.getJSONObject(position).getString("texto").isEmpty()){
                        textView_user_2.setVisibility(View.GONE);
                    } else {
                        textView_user_2.setVisibility(View.VISIBLE);
                    }
                } else {
                    imgMedia_2.setVisibility(View.GONE);
                    textView_user_2.setVisibility(View.VISIBLE);
                }
            }

            if(array.getJSONObject(position).has("nuevoDia")){
                TextView nuevoDia = holder.nuevoDia;
                consMensajeIntermedio.setVisibility(View.VISIBLE);
                nuevoDia.setText(array.getJSONObject(position).getString("hora").split(" ")[0]);
            }else {
                consMensajeIntermedio.setVisibility(View.GONE);
            }
            if(array.getJSONObject(position).has("final")){
                but_verMensajesAnteriores.setVisibility(View.VISIBLE);
                but_verMensajesAnteriores.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View view) {
                        pop_mensajes.actualizarAdaptadorCargaMensajes(true);
                    }
                });
            }else {
                but_verMensajesAnteriores.setVisibility(View.GONE);
            }
            if(array.getJSONObject(position).has("inicio")){
                //estadoInicio = true;
                but_verMensajesAnteriores.setVisibility(View.GONE);
            }


        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    public Context getContext(){return context;}
    public void reply_deslizar(int pos){
        pop_mensajes.reply_deslizar(pos);
        //funcionesComunes.toast("paso", context);
    }
    public JSONArray getArray(){return array;}
    @Override
    public int getItemCount() {
        return array.length();
    }
    public void add(JSONObject object){
        array.put(object);
        notifyItemInserted(array.length()-1);
    }
    public void actualizar(JSONArray array){
        this.array = array;
        notifyDataSetChanged();
    }

    public class ViewHolder extends RecyclerView.ViewHolder {
        ConstraintLayout cons_1, cons_2, consMensajeIntermedio;
        TextView user_1, user_2;
        TextView textView_user_1, textView_user_2;
        TextView hora_user_1, hora_user_2;
        ImageView imageView_User_1, imageView_User_2;
        TextView  nuevoDia;
        Button    verMensajesAnteriores;

        ConstraintLayout replyConsUser_1, replyConsUser_2;
        TextView replyEncabezado_user_1, replyTexto_User_1;
        TextView replyEncabezado_user_2, replyTexto_User_2;
        ImageView imgMedia_user_1, imgMedia_user_2;
        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            cons_1                  = (ConstraintLayout)  itemView.findViewById(R.id.cons_usuario_1);
            cons_2                  = (ConstraintLayout)  itemView.findViewById(R.id.cons_usuario_2);
            consMensajeIntermedio   = (ConstraintLayout) itemView.findViewById(R.id.constraintLayout78);

            textView_user_1 = (TextView) itemView.findViewById(R.id.editTextText6_m);
            textView_user_2 = (TextView) itemView.findViewById(R.id.editTextText7_m);
            user_1 = (TextView) itemView.findViewById(R.id.textView609);
            user_2 = (TextView) itemView.findViewById(R.id.textView613);

            hora_user_1 = (TextView)itemView.findViewById(R.id.textView619);
            hora_user_2 = (TextView)itemView.findViewById(R.id.textView618);

            imageView_User_1 = (ImageView)itemView.findViewById(R.id.imageView32);
            imageView_User_2 = (ImageView)itemView.findViewById(R.id.imageView34);

            imgMedia_user_1 = (ImageView)itemView.findViewById(R.id.imgMedia_user_1);
            imgMedia_user_2 = (ImageView)itemView.findViewById(R.id.imgMedia_user_2);

            nuevoDia = (TextView) itemView.findViewById(R.id.textView616);

            verMensajesAnteriores = (Button) itemView.findViewById(R.id.button197);

            replyConsUser_1         = (ConstraintLayout) itemView.findViewById(R.id.consReplyUser_1);
            replyConsUser_2         = (ConstraintLayout) itemView.findViewById(R.id.consReplyUser_2);
            replyEncabezado_user_1  = (TextView) itemView.findViewById(R.id.textView63_0);
            replyTexto_User_1       = (TextView) itemView.findViewById(R.id.textView63_7);
            replyEncabezado_user_2  = (TextView) itemView.findViewById(R.id.textView630);
            replyTexto_User_2       = (TextView) itemView.findViewById(R.id.textView637);


        }
    }
}