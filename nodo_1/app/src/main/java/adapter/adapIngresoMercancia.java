package adapter;

import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonSiglas;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.example.nodo_1.R;
import com.example.nodo_1.generales;
import com.google.android.material.textfield.TextInputEditText;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import pop.pop_selec_talla;

public class adapIngresoMercancia extends RecyclerView.Adapter<adapIngresoMercancia.ViewHolder>{
    Context context;
    JSONArray array = new JSONArray();
    boolean baderaEdicion = false;
    String idInicioSiguiente = "12300001";
    boolean banderaPrimerIngreso = false;
    String idUltimo = "";
    Activity activity;
    public adapIngresoMercancia(Context context, Activity activity){
        this.activity = activity;
        this.context = context;
        if (jsonArticulos.length() > 0){
            try {
                idInicioSiguiente = jsonArticulos.getJSONObject(jsonArticulos.names().getString(jsonArticulos.names().length()-1)).getString("id");
                idInicioSiguiente = String.valueOf(Integer.parseInt(idInicioSiguiente) + 1);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else banderaPrimerIngreso = true;
        JSONObject object = new JSONObject();
        try {
            object.put("id", idInicioSiguiente);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        array.put(object);
    }
    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.ingreso_mercancia_recycler_reg_1, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button
                but = holder.but,
                butSiglaExistente = holder.butSiglaExistente,
                but_generarsigla = holder.but_generarsigla;

        ConstraintLayout consModificar = holder.consMod;
        Button butMod = holder.butMod;
        TextInputEditText
                nombre          = holder.nombre,
                codigo          = holder.codigo,
                referencia      = holder.referencia,
                sigla           = holder.sigla,
                cantidad        = holder.cantidad,
                compra          = holder.compra,
                venta           = holder.venta,
                utilidad        = holder.utilidad,
                utilidadTotal   = holder.utilidadTotal,
                mayoreo         = holder.mayoreo,
                cantMayoreo     = holder.cantMayoreo,
                genero          = holder.genero,
                subgenero       = holder.subgenero,
                hashtags        = holder.hashtags;

        Button but_photoBarCode = holder.but_photoBarCode;
        CheckBox checkBox_descuento = holder.checkBox_descuento;
        EditText descuentoEdittext  = holder.descuentoEdittext;

        setupEditorActionListener(nombre,        holder);
        setupEditorActionListener(codigo,        holder);
        setupEditorActionListener(referencia,    holder);
        setupEditorActionListener(sigla,         holder);
        setupEditorActionListener(cantidad,      holder);
        setupEditorActionListener(compra,        holder);
        setupEditorActionListener(venta,         holder);
        setupEditorActionListener(utilidad,      holder);
        setupEditorActionListener(utilidadTotal, holder);
        setupEditorActionListener(mayoreo,       holder);
        setupEditorActionListener(cantMayoreo,   holder);
        setupEditorActionListener_EditText(descuentoEdittext,   holder);



        CheckBox
        checkBoxIndicarTalla = holder.checkBoxIndicarTalla, checkBoxIndicarSeña = holder.checkBoxIndicarSeña, check_2x1 = holder.check_2x1;

        try {
            codigo      .setText( array.getJSONObject(position).getString("id"));
            checkBoxIndicarSeña .setChecked(false);
            checkBoxIndicarTalla.setChecked(false);
            check_2x1           .setChecked(false);
            butSiglaExistente.setVisibility(View.GONE);
            if(array.getJSONObject(position).has("preciCompra")){
                try {
                    if(array.getJSONObject(position).has("completo")){
                        consModificar.setVisibility(View.VISIBLE);
                    }else consModificar.setVisibility(View.GONE);

                    JSONObject object = array.getJSONObject(position);

                    nombre       .setText( object.getString("nombre"));
                    referencia   .setText( object.getString("referencia"));
                    cantidad     .setText( object.getString("cantidad"));
                    compra       .setText( object.getString("preciCompra"));
                    venta        .setText( object.getString("precioVenta"));
                    utilidad     .setText( object.getString("utilidad"));
                    utilidadTotal.setText( object.getString("utilidadTotal"));

                    if(object.has("sigla"))sigla.setText( object.getString("sigla"));
                    else sigla.setText("");
                    if (object.has("mayoreo"))mayoreo.setText(object.getString("mayoreo"));
                    else mayoreo.setText("");
                    if (object.has("cantMayoreo"))cantMayoreo.setText(object.getString("cantMayoreo"));
                    else cantMayoreo.setText("");
                    if (object.has("genero"))genero.setText(object.getString("genero"));
                    else genero.setText("");
                    if (object.has("subgenero"))subgenero.setText(object.getString("subgenero"));
                    else subgenero.setText("");
                    if (object.has("hashtags"))hashtags.setText(object.getString("hashtags"));
                    else hashtags.setText("");
                    if (object.has("tallas")){
                        checkBoxIndicarTalla.setChecked(true);
                    }else checkBoxIndicarTalla.setChecked(false);
                    if (object.has("seña")){
                        checkBoxIndicarSeña.setChecked(true);
                    }else checkBoxIndicarSeña.setChecked(false);
                    if(object.has("3x2")){
                        check_2x1.setChecked(true);
                    }else check_2x1.setChecked(false);
                    if(object.has("descuento")) {
                        checkBox_descuento.setEnabled(true);
                    } else checkBox_descuento.setEnabled(false);
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }else {
                consModificar.setVisibility(View.GONE);
                nombre       .setText("");
                referencia   .setText("");
                if (array.getJSONObject(position).has("sigla")){
                    sigla        .setText(array.getJSONObject(position).getString("sigla"));
                }else  sigla        .setText("");
                cantidad     .setText("");
                compra       .setText("");
                venta        .setText("");
                utilidad     .setText("");
                utilidadTotal.setText("");
                mayoreo      .setText("");
                cantMayoreo  .setText("");
                genero       .setText("");
                subgenero    .setText("");
                hashtags     .setText("");
                descuentoEdittext.setText("");
            }
            but_photoBarCode.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    ((com.example.nodo_1.ingresoMercancia) activity).photoBarcode(holder.getAdapterPosition());
                }
            });
            but_generarsigla.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    ArrayList<String> arrayList = new ArrayList<>();
                    if(array.length() > 0){
                        for (int x = 0; x < array.length(); x++){
                            try {
                                if(array.getJSONObject(x).has("sigla")){
                                    arrayList.add(array.getJSONObject(x).getString("sigla"));
                                }
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    }
                    if(jsonSiglas.length() > 0){
                        for (int i = 0; i < jsonSiglas.names().length(); i++){
                            try {
                                arrayList.add(jsonSiglas.names().getString(i));
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    }
                    sigla.setText(generarCadenaUnica(arrayList));
                }
            });

            // Image handling
            ImageView imgArticulo = holder.imgArticulo;
            Button butAgregarImagen = holder.butAgregarImagen;
            Button butQuitarImagen = holder.butQuitarImagen;

            if (imagenBytesPorPosicion.containsKey(position)) {
                byte[] bytes = imagenBytesPorPosicion.get(position);
                Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                imgArticulo.setImageBitmap(bmp);
                imgArticulo.setVisibility(View.VISIBLE);
                butQuitarImagen.setVisibility(View.VISIBLE);
            } else if (array.getJSONObject(position).has("imagenUrl")) {
                Glide.with(context).load(array.getJSONObject(position).getString("imagenUrl")).into(imgArticulo);
                imgArticulo.setVisibility(View.VISIBLE);
                butQuitarImagen.setVisibility(View.VISIBLE);
            } else {
                imgArticulo.setVisibility(View.GONE);
                butQuitarImagen.setVisibility(View.GONE);
            }

            butAgregarImagen.setOnClickListener(v -> {
                pickImageForPosition = holder.getAdapterPosition();
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.setType("image/*");
                activity.startActivityForResult(intent, REQUEST_PICK_IMAGE_ARTICULO);
            });

            butQuitarImagen.setOnClickListener(v -> {
                int pos = holder.getAdapterPosition();
                imagenUriPorPosicion.remove(pos);
                imagenBytesPorPosicion.remove(pos);
                try {
                    array.getJSONObject(pos).remove("imagenUrl");
                } catch (JSONException ex) {}
                imgArticulo.setVisibility(View.GONE);
                butQuitarImagen.setVisibility(View.GONE);
            });

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

        sigla.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override
            public void afterTextChanged(Editable editable) {
                if(sigla.length() > 0){
                    if(array.length() > 0){
                        String siglaIngresada = sigla.getText().toString();
                        boolean existeEnesteRegistro = false;
                        for (int x = 0; x < array.length(); x++){
                            try {
                                if(array.getJSONObject(x).has("sigla")){
                                    if(array.getJSONObject(x).getString("sigla").equals(siglaIngresada)){
                                        butSiglaExistente.setVisibility(View.VISIBLE);
                                        existeEnesteRegistro = true;
                                    }
                                }
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                        if(!existeEnesteRegistro && !banderaPrimerIngreso){
                            if(jsonSiglas.length() > 0){
                                if(jsonSiglas.has(siglaIngresada)){
                                    existeEnesteRegistro = true;
                                    butSiglaExistente.setVisibility(View.VISIBLE);
                                }
                            }
                        }
                        if(!existeEnesteRegistro)butSiglaExistente.setVisibility(View.GONE);

                    }
                }else butSiglaExistente.setVisibility(View.GONE);
            }
        });
        compra.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override
            public void afterTextChanged(Editable editable) {
                if(venta.length() >  0 && compra.length() > 0){
                    int utlUnitario = Integer.parseInt(venta.getText().toString()) - Integer.parseInt(compra.getText().toString());
                    utilidad.setText(String.valueOf(utlUnitario));
                    try {
                        array.getJSONObject(holder.getAdapterPosition()).put("utilidad", String.valueOf(utlUnitario));
                        if(cantidad.length() > 0){
                            String ultTotal = String.valueOf(Integer.parseInt(cantidad.getText().toString()) * utlUnitario);
                            utilidadTotal.setText(ultTotal);
                            array.getJSONObject(holder.getAdapterPosition()).put("utilidadTotal", ultTotal);
                        }else utilidadTotal.setText("");
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }else utilidad.setText("");
            }
        });
        venta.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
            @Override
            public void afterTextChanged(Editable editable) {
                if(venta.length() >  0 && compra.length() > 0){
                    int utlUnitario = Integer.parseInt(venta.getText().toString()) - Integer.parseInt(compra.getText().toString());
                    utilidad.setText(String.valueOf(utlUnitario));
                    try {
                        array.getJSONObject(holder.getAdapterPosition()).put("utilidad", String.valueOf(utlUnitario));
                        if(cantidad.length() > 0){
                            String ultTotal = String.valueOf(Integer.parseInt(cantidad.getText().toString()) * utlUnitario);
                            utilidadTotal.setText(ultTotal);
                            array.getJSONObject(holder.getAdapterPosition()).put("utilidadTotal", ultTotal);
                        }else utilidadTotal.setText("");
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }else utilidad.setText("");
            }
        });

        but.setOnClickListener(new View.OnClickListener() {
            // nombre codigo referencia sigla cantidad compra venta utilidad
            @Override
            public void onClick(View view) {
                JSONObject object = new JSONObject();
                try {
                    if(codigo.length() > 0
                    && cantidad.length() > 0 && compra.length() > 0
                    && venta.length() > 0 && utilidadTotal.length() > 0){
                        boolean estadoMayoreo = false;
                        if(mayoreo.length() > 0 || cantMayoreo.length() > 0){
                            if(mayoreo.length() > 0 && cantMayoreo.length() > 0){
                            }else  estadoMayoreo = true;
                        }
                        if(!estadoMayoreo){
                            object.put("completo", "");
                            object.put("nombre", nombre.getText().toString());
                            if(referencia.length()>0) object.put("referencia", referencia.getText().toString());
                            else object.put("referencia", "");

                            if (sigla.length() > 0){
                                object.put("sigla", sigla.getText().toString());
                            }
                            if(mayoreo.length() > 0){
                                object.put("mayoreo", mayoreo.getText().toString());
                            }
                            if(cantMayoreo.length() > 0){
                                object.put("cantMayoreo", cantMayoreo.getText().toString());
                            }
                            if(genero.length() > 0){
                                object.put("genero", genero.getText().toString());
                            }
                            if(subgenero.length() > 0){
                                object.put("subgenero", subgenero.getText().toString());
                            }
                            if(hashtags.length() > 0){
                                object.put("hashtags", hashtags.getText().toString());
                            }
                            object.put("cantidad", cantidad.getText().toString());
                            object.put("preciCompra", compra.getText().toString());
                            object.put("precioVenta", venta.getText().toString());
                            object.put("utilidad", utilidad.getText().toString());
                            object.put("utilidadTotal", utilidadTotal.getText().toString());
                            object.put("id", array.getJSONObject(holder.getAdapterPosition()).getString("id"));

                            /**SI NO ESTA SELECCIONADA**/
                            if (!checkBoxIndicarTalla.isChecked()){
                                if(object.has("tallas"))object.remove("tallas");
                            }else object.put("tallas", array.getJSONObject(holder.getAdapterPosition()).getString("tallas"));

                            if (checkBoxIndicarSeña.isChecked()){
                                object.put("seña", "1");
                            }
                            if(check_2x1.isChecked()){
                                object.put("2x1", "1");
                            }
                            if(checkBox_descuento.isChecked()){
                                object.put("descuento", descuentoEdittext.getText().toString());
                            }

                            array.put(holder.getAdapterPosition(), object);

                            consModificar.setVisibility(View.VISIBLE);
                            baderaEdicion = false;

                            nombre      .clearFocus();
                            referencia  .clearFocus();
                            sigla       .clearFocus();
                            cantidad    .clearFocus();
                            compra      .clearFocus();
                            venta       .clearFocus();
                            mayoreo     .clearFocus();
                            cantMayoreo .clearFocus();

                        }else {
                            toast("FALTA 1 CAMPO DE MAYOREO");
                        }
                    }
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
        butMod.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                baderaEdicion = true;
                try {
                    array.getJSONObject(holder.getAdapterPosition()).remove("completo");
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
                consModificar.setVisibility(View.GONE);
            }
        });
        if (position == array.length()-1) {
            try {
                idUltimo = array.getJSONObject(position).getString("id");
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        checkBoxIndicarTalla.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (checkBoxIndicarTalla.isChecked()){
                    if(!jsonDatos.has("tallas")){
                        toast("AGREGUE 1 TALLA EN LA SECCION, GESTOR DE OFERTAS");
                        checkBoxIndicarTalla.setChecked(false);
                    }else {
                        checkBoxTalla = checkBoxIndicarTalla;
                        pop.pop_selec_talla pop_selec_talla  = new pop_selec_talla();
                        pop_selec_talla.showPopupWindow(view, adapIngresoMercancia.this, holder.getAdapterPosition(), "");
                    }
                }
            }
        });
        checkBox_descuento.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(checkBox_descuento.isChecked()){
                    descuentoEdittext.setEnabled(true);
                }else {
                    descuentoEdittext.setEnabled(false);
                    descuentoEdittext.setText("");
                }
            }
        });
    }
    CheckBox checkBoxTalla;
    int indexTalla = -1;
    public void selecTallaEnPop(String apuntador_str, int index){
        try {
            array.getJSONObject(index).put("tallas", apuntador_str);
            indexTalla = index;
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    PopupWindow popupWindow;
    public void getPopupWindow_confirmar(PopupWindow popupWindow){this.popupWindow = popupWindow;}
    public void initPop_confirmar(){
        popupWindow.setOnDismissListener(new PopupWindow.OnDismissListener() {
            @Override
            public void onDismiss() {
                try {
                    if(indexTalla >= 0){
                        if(!array.getJSONObject(indexTalla).has("tallas")){
                            toast("NINGUNA TALLA ASIGNADA");checkBoxTalla.setChecked(false);
                        }
                    }else {
                        toast("NINGUNA TALLA ASIGNADA");checkBoxTalla.setChecked(false);
                    }
                    indexTalla = -1;
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
    }
    public void actualizarLiga_photoScanner(int index, String s){
        try {
            array.getJSONObject(index).put("sigla", s);
            notifyItemChanged(index);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    private void setupEditorActionListener(TextInputEditText editText, final ViewHolder holder) {
        editText.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_NEXT) {

                    // Simular un clic en el boton
                    holder.but.performClick();

                    return true; // Manejar el evento aqui
                }
                return false;
            }
        });
    }
    private void setupEditorActionListener_EditText(EditText editText, final ViewHolder holder) {
        editText.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_NEXT) {

                    // Simular un clic en el boton
                    holder.but.performClick();

                    return true; // Manejar el evento aqui
                }
                return false;
            }
        });
    }



    private static final String LETRAS = "abcdefghijklmnopqrstuvwxyz";

    /**
     * Genera una cadena unica que no existe en la lista proporcionada.
     *
     * @param listaExistente Lista de cadenas existentes.
     * @return Una cadena unica que no esta en la lista.
     */
    public static String generarCadenaUnica(List<String> listaExistente) {
        int longitud = 1;

        while (true) {
            List<String> combinaciones = generarCombinaciones(longitud);
            for (String cadena : combinaciones) {
                if (!listaExistente.contains(cadena)) {
                    return cadena;
                }
            }
            longitud++;
        }
    }

    /**
     * Genera todas las combinaciones posibles de letras minusculas para una longitud dada.
     *
     * @param longitud Longitud de las cadenas a generar.
     * @return Lista de cadenas generadas.
     */
    private static List<String> generarCombinaciones(int longitud) {
        List<String> combinaciones = new ArrayList<>();
        generarCombinacionesRecursivo("", longitud, combinaciones);
        return combinaciones;
    }

    /**
     * Metodo recursivo para generar combinaciones de letras.
     *
     * @param prefijo       Prefijo actual de la cadena.
     * @param longitud      Longitud restante por generar.
     * @param combinaciones Lista donde se almacenan las combinaciones generadas.
     */
    private static void generarCombinacionesRecursivo(String prefijo, int longitud, List<String> combinaciones) {
        if (longitud == 0) {
            combinaciones.add(prefijo);
            return;
        }
        for (int i = 0; i < LETRAS.length(); i++) {
            generarCombinacionesRecursivo(prefijo + LETRAS.charAt(i), longitud - 1, combinaciones);
        }
    }



    @Override
    public int getItemCount() {
        return array.length();
    }

    public void agregar(){
        if(!baderaEdicion){
            JSONObject object = new JSONObject();
            try {
                object.put("id", String.valueOf(Integer.parseInt(array.getJSONObject(array.length()-1).getString("id")) + 1));
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
            array.put(object);
            notifyItemInserted(array.length()-1);
        }else toast("TERMINE DE MODIFICAR EL REGISTRO");

    }
    public void reset(){
        array = new JSONArray();
        if (jsonArticulos.length() > 0){
            try {
                idInicioSiguiente = jsonArticulos.getJSONObject(jsonArticulos.names().getString(jsonArticulos.names().length()-1)).getString("id");
                idInicioSiguiente = String.valueOf(Integer.parseInt(idInicioSiguiente) + 1);
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }else banderaPrimerIngreso = true;
        JSONObject object = new JSONObject();
        try {
            object.put("id", idInicioSiguiente);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
        array.put(object);
        notifyDataSetChanged();
    }
    public JSONArray registroCompleto(){
        return array;
    }
    public void clear(){
        try {
            if(!idUltimo.isEmpty()){
                idUltimo = String.valueOf(Integer.parseInt(idUltimo) + 1);
                array = new JSONArray();
                JSONObject object = new JSONObject();
                object.put("id", idUltimo);
                array.put(object);
                notifyDataSetChanged();
            }else toast("no hay lementos");

        } catch (JSONException e) {
            throw new RuntimeException(e);
        }

    }

    public static final int REQUEST_PICK_IMAGE_ARTICULO = 2001;
    private int pickImageForPosition = -1;
    private Map<Integer, Uri> imagenUriPorPosicion = new HashMap<>();
    private Map<Integer, byte[]> imagenBytesPorPosicion = new HashMap<>();

    public void onImageResult(Uri uri) {
        if (pickImageForPosition >= 0 && uri != null) {
            imagenUriPorPosicion.put(pickImageForPosition, uri);
            // Compress in background
            final int pos = pickImageForPosition;
            new Thread(() -> {
                byte[] compressed = media.ImageCompressor.compress(context, uri, 800 * 1024);
                if (compressed != null) {
                    imagenBytesPorPosicion.put(pos, compressed);
                }
                ((Activity) activity).runOnUiThread(() -> notifyItemChanged(pos));
            }).start();
            pickImageForPosition = -1;
        }
    }

    public int getPickImageForPosition() { return pickImageForPosition; }

    public byte[] getImageBytes(int position) {
        return imagenBytesPorPosicion.get(position);
    }

    public class ViewHolder extends RecyclerView.ViewHolder {

        Button but, butMod, butSiglaExistente, but_generarsigla, but_photoBarCode;
        TextInputEditText nombre, codigo, referencia, sigla, cantidad, compra, venta, utilidad, utilidadTotal,
        mayoreo, cantMayoreo, genero, subgenero, hashtags;

        CheckBox checkBox_descuento;
        EditText descuentoEdittext;

        ConstraintLayout consMod;

        CheckBox checkBoxIndicarTalla, checkBoxIndicarSeña, check_2x1;

        ImageView imgArticulo;
        Button butAgregarImagen, butQuitarImagen;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            but = (Button) itemView.findViewById(R.id.butConfirmarRegIngMerc);
            butSiglaExistente = (Button) itemView.findViewById(R.id.butSiglaExistente);

            nombre          = (TextInputEditText) itemView.findViewById(R.id.inputEditText_NotaIndividual_Eqp_trabajo);
            codigo          = (TextInputEditText) itemView.findViewById(R.id.inputEditText_10);
            referencia      = (TextInputEditText) itemView.findViewById(R.id.inputEditText_9);
            sigla           = (TextInputEditText) itemView.findViewById(R.id.inputEditText_11);
            cantidad        = (TextInputEditText) itemView.findViewById(R.id.inputEditText_12);
            compra          = (TextInputEditText) itemView.findViewById(R.id.inputEditText_13);
            venta           = (TextInputEditText) itemView.findViewById(R.id.inputEditText_14);
            utilidad        = (TextInputEditText) itemView.findViewById(R.id.inputEditText_15);
            utilidadTotal   = (TextInputEditText) itemView.findViewById(R.id.inputEditText_16);
            butMod          = (Button) itemView.findViewById(R.id.butModificarregIngMerc);
            consMod         = (ConstraintLayout) itemView.findViewById(R.id.consModificarRegIngMerc);
            mayoreo         = (TextInputEditText) itemView.findViewById(R.id.textImputLayoutMayoreo);
            cantMayoreo     = (TextInputEditText) itemView.findViewById(R.id.inmputEditText_canMayoreo);
            genero          = (TextInputEditText) itemView.findViewById(R.id.inputEditText_genero);
            subgenero       = (TextInputEditText) itemView.findViewById(R.id.inputEditText_subgenero);
            hashtags        = (TextInputEditText) itemView.findViewById(R.id.inputEditText_hashtags);

            checkBox_descuento   = (CheckBox) itemView.findViewById(R.id.checkBoxDescuento);
            checkBoxIndicarTalla = (CheckBox) itemView.findViewById(R.id.checkBoxIndicarTalla);
            checkBoxIndicarSeña  = (CheckBox) itemView.findViewById(R.id.checkBoxIndicarSeña);
            check_2x1            = (CheckBox) itemView.findViewById(R.id.checkBoxIndicarcheck_2x1);

            but_generarsigla = (Button) itemView.findViewById(R.id.butgenerarSiglaRegAdapter);
            but_photoBarCode = (Button) itemView.findViewById(R.id.but_photoBarCode);

            descuentoEdittext = (EditText) itemView.findViewById(R.id.editTextTextDescuento);

            imgArticulo      = (ImageView) itemView.findViewById(R.id.imgArticulo);
            butAgregarImagen = (Button) itemView.findViewById(R.id.butAgregarImagen);
            butQuitarImagen  = (Button) itemView.findViewById(R.id.butQuitarImagen);
        }
    }
    private void toast (String s){
        generales.toast(s, context);
    }
}
